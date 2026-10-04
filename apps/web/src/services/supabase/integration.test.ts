import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { todayLima } from "@vexa/domain/dates";
import type { Services } from "@vexa/services";
import { createSupabaseClient, type VexaSupabase } from "@/lib/supabase";
import type { CredentialsAuthService } from "./auth";
import { createSupabaseServices } from "./index";

/**
 * Prueba de integración contra el Supabase LOCAL (`npm run db:start`). Se omite si faltan
 * `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Usa las cuentas del seed (solo para desarrollo local).
 * Deja poco rastro (un borrador de reloj cerrado y registros anulados): `npm run db:reset` lo limpia.
 *
 * Variables (solo en el entorno del comando, nunca en archivos): `SUPABASE_URL` es `API_URL` y
 * `SUPABASE_ANON_KEY` es `ANON_KEY` de `supabase status -o env`. Después: `npm run test:integration`.
 */
const url = import.meta.env.SUPABASE_URL as string | undefined;
const key = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
const PASSWORD = "vexa-local-dev";
const TASK_ROBER = "30000000-0000-4000-8000-000000000005"; // en curso, de Rober
const ROBER = "00000000-0000-4000-8000-000000000002";
const ALEX = "00000000-0000-4000-8000-000000000005";

interface Session {
  client: VexaSupabase;
  services: Services;
  auth: CredentialsAuthService;
}

function connect(): Session {
  const client = createSupabaseClient(url!, key!, { persistSession: false });
  const services = createSupabaseServices(client);
  return { client, services, auth: services.auth as CredentialsAuthService };
}

async function login(email: string): Promise<Session> {
  const session = connect();
  await session.auth.signInWithPassword(email, PASSWORD);
  return session;
}

describe.skipIf(!url || !key)("Supabase local (integración)", () => {
  const startedAt = new Date(Date.now() - 5000).toISOString();
  let admin: Session;
  let rober: Session;
  let alex: Session;

  beforeAll(async () => {
    [admin, rober, alex] = await Promise.all([
      login("jhony@vexa.test"),
      login("rober@vexa.test"),
      login("alex@vexa.test"),
    ]);
  });

  afterAll(async () => {
    // Que ninguna corrida deje un reloj abierto.
    await rober?.services.time.stop();
  });

  it("inicia sesión, restaura la sesión y rechaza credenciales malas", async () => {
    expect(await rober.services.auth.getSession()).toMatchObject({
      id: ROBER,
      role: "partner",
    });
    await expect(
      connect().auth.signInWithPassword("rober@vexa.test", "incorrecta"),
    ).rejects.toThrow("Correo o contraseña incorrectos");
    expect(await connect().services.auth.getSession()).toBeNull();
  });

  it("lista tareas como 'Mis tareas' (propias) y el tablero del proyecto completo", async () => {
    const mine = await rober.services.tasks.list();
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((t) => t.assigneeId === ROBER)).toBe(true);

    const all = await admin.services.tasks.list();
    expect(all.length).toBeGreaterThan(mine.length);

    const projects = await rober.services.projects.list();
    const board = await rober.services.tasks.list({ projectId: projects[0].id });
    expect(board.some((t) => t.assigneeId !== ROBER)).toBe(true);
    expect(Array.isArray(board[0].labels)).toBe(true);
  });

  it("mueve una tarea y la deja como estaba", async () => {
    const moved = await rober.services.tasks.move(TASK_ROBER, "review");
    expect(moved.status).toBe("review");
    const back = await rober.services.tasks.move(TASK_ROBER, "in_progress");
    expect(back.status).toBe("in_progress");
    // Quien no es responsable no puede moverla.
    await expect(alex.services.tasks.move(TASK_ROBER, "done")).rejects.toThrow(
      "Solo puedes trabajar en tus tareas asignadas",
    );
  });

  it("recorre el reloj: iniciar, pausar, reanudar, detener y confirmar el borrador", async () => {
    const { time } = rober.services;
    const started = await time.start(TASK_ROBER);
    expect(started).toMatchObject({ timerState: "running", taskId: TASK_ROBER });
    expect((await time.getRunning())?.id).toBe(started.id);
    expect((await time.pause())?.timerState).toBe("paused");
    expect((await time.resume())?.timerState).toBe("running");

    const stopped = await time.stop();
    expect(stopped?.endedAt).not.toBeNull();
    expect(stopped?.draft).toBe(true);
    expect(await time.getRunning()).toBeNull();
    expect(await time.stop()).toBeNull();

    const draft = (await time.listDrafts()).find((d) => d.taskId === TASK_ROBER);
    expect(draft).toBeDefined();
    const entry = await time.submitDrafts({
      items: [{ id: draft!.id, hours: 0.5 }],
      date: todayLima(),
    });
    expect(entry.hours).toBe(0.5);
    expect(entry.allocations?.[0]?.taskId).toBe(TASK_ROBER);
    const voided = await time.void(entry.id, "Prueba de integración");
    expect(voided.voidedAt).not.toBeNull();
  });

  it("aprueba solo hasta el límite y deja pendiente lo demás", async () => {
    const { expenses } = rober.services;
    const small = await expenses.create({
      amount: 10,
      currency: "PEN",
      concept: "Prueba de integración (pequeño)",
      category: "other",
      receiptUrl: null,
    });
    const large = await expenses.create({
      amount: 80,
      currency: "PEN",
      concept: "Prueba de integración (grande)",
      category: "other",
      receiptUrl: null,
    });
    expect(small.status).toBe("approved");
    expect(large.status).toBe("pending");
    expect(await expenses.listVotes(large.id)).toEqual([]);
    for (const expense of [small, large])
      expect((await expenses.void(expense.id, "Limpieza de la prueba")).status).toBe("voided");
    // Los colaboradores no ven gastos ni el dashboard.
    await expect(alex.services.expenses.list()).rejects.toThrow("socios y administradores");
  });

  it("calcula el dashboard en la base con el mismo formato del mock", async () => {
    const summary = await admin.services.dashboard.getMonthlySummary(
      todayLima().slice(0, 7),
    );
    expect(summary).toHaveLength(4);
    expect(summary[0]).toEqual({
      userId: expect.any(String),
      month: todayLima().slice(0, 7),
      hours: expect.any(Number),
      minimumHours: expect.any(Number),
      compliance: expect.any(Number),
      meetsMinimum: expect.any(Boolean),
    });
    const points = await admin.services.dashboard.getPoints();
    expect(points).toHaveLength(4);
    expect(points.reduce((sum, p) => sum + p.participation, 0)).toBeCloseTo(1, 5);
    await expect(alex.services.dashboard.getPoints()).rejects.toThrow("socios y administradores");
  });

  it("registra la actividad con la hora del servidor, el request id y el cliente", async () => {
    const page = await admin.services.audit.list({ from: startedAt, actorId: ROBER });
    const moves = page.items.filter(
      (e) => e.eventType === "task.moved" && e.entity.id === TASK_ROBER,
    );
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves[0]).toMatchObject({
      actorId: ROBER,
      actorRole: "partner",
      client: { platform: "web", appVersion: "0.0.0" },
      entity: { table: "tasks", label: expect.any(String) },
    });
    expect(moves[0].requestId).toMatch(/^r-/);
    expect(moves[0].requestId).not.toBe(moves[1].requestId);
    expect(moves[0].clientAt).not.toBeNull();
    expect(Date.parse(moves[0].occurredAt)).toBeGreaterThan(Date.parse(startedAt));
    const types = new Set(page.items.map((e) => e.eventType));
    for (const type of ["timer.started", "timer.paused", "timer.resumed", "timer.stopped", "hours.confirmed", "hours.voided"])
      expect(types).toContain(type);

    const history = await admin.services.audit.timeline({ table: "tasks", id: TASK_ROBER });
    expect(history.filter((e) => e.eventType === "task.moved").length).toBeGreaterThanOrEqual(2);
    expect(history.map((e) => e.seq)).toEqual([...history.map((e) => e.seq)].sort((a, b) => b - a));
  });

  it("pagina por seq sin repetir entradas", async () => {
    const first = await admin.services.audit.list({}, null, 2);
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBe(first.items[1].seq);
    const second = await admin.services.audit.list({}, first.nextCursor, 2);
    expect(second.items[0].seq).toBeLessThan(first.items[1].seq);
  });

  it("limita la visibilidad por rol", async () => {
    const adminSees = await admin.services.audit.list({ actorId: ROBER, from: startedAt });
    const roberSees = await rober.services.audit.list({ from: startedAt });
    expect(adminSees.items.length).toBeGreaterThan(0);
    expect(roberSees.items.length).toBeGreaterThanOrEqual(adminSees.items.length);
    // Un colaborador solo ve sus propias acciones: nada de lo que hizo Rober.
    const alexSees = await alex.services.audit.list({ from: startedAt });
    expect(alexSees.items.every((e) => e.actorId === ALEX)).toBe(true);
    // Sin sesión no hay lectura.
    const anon = await connect().services.audit.list().catch((error: Error) => error);
    expect(anon instanceof Error || anon.items.length === 0).toBe(true);
  });

  it("verifica la cadena de hashes (solo admin)", async () => {
    const { data, error } = await admin.client.rpc("verify_audit_chain");
    expect(error).toBeNull();
    expect(data).toBeNull();
    const denied = await rober.client.rpc("verify_audit_chain");
    expect(denied.error).not.toBeNull();
  });
});
