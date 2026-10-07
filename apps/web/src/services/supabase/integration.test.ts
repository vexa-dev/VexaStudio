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
  it("guarda la foto en Storage, la sirve firmada a otro miembro y la quita", async () => {
    // PNG de 1x1: solo importa que sea una imagen valida, no su contenido.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    try {
      const profile = await alex.services.auth.updateProfileMedia({ avatarUrl: png });
      expect(profile.avatarUrl).toMatch(/^https?:\/\/.+\/storage\/v1\/object\/sign\/avatars\//);
      const response = await fetch(profile.avatarUrl!);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toMatch(/^image\//);

      // Otro miembro del estudio la ve en el equipo.
      const seenByRober = (await rober.services.members.list()).find((m) => m.id === ALEX);
      expect(seenByRober?.avatarUrl).toMatch(/\/storage\/v1\/object\/sign\/avatars\//);
      expect((await fetch(seenByRober!.avatarUrl!)).status).toBe(200);
    } finally {
      const cleared = await alex.services.auth.updateProfileMedia({ avatarUrl: null });
      expect(cleared.avatarUrl ?? null).toBeNull();
    }
    const after = (await rober.services.members.list()).find((m) => m.id === ALEX);
    expect(after?.avatarUrl ?? null).toBeNull();
  });

  it("avisa una tarea asignada, la marca como leída y no la muestra a otra persona", async () => {
    const title = `Aviso de integración ${Date.now()}`;
    await admin.services.tasks.create({
      sprintId: null,
      projectId: "10000000-0000-4000-8000-000000000001",
      title,
      assigneeId: ROBER,
      estimateHours: null,
      link: null,
    });
    const own = await rober.services.notifications.list();
    const notice = own.find((n) => n.payload.taskName === title);
    expect(notice).toMatchObject({
      userId: ROBER,
      type: "task_assigned",
      read: false,
      payload: { actorName: "Jhony Rivera", taskName: title },
    });

    await rober.services.notifications.markRead(notice!.id);
    const afterOne = await rober.services.notifications.list();
    expect(afterOne.find((n) => n.id === notice!.id)?.read).toBe(true);

    await rober.services.notifications.markAllRead();
    const afterAll = await rober.services.notifications.list();
    expect(afterAll.some((n) => !n.read)).toBe(false);

    // Alex no ve el aviso de Rober.
    const others = await alex.services.notifications.list();
    expect(others.some((n) => n.payload.taskName === title)).toBe(false);
  });

  it("perfil propio y preferencias: usuario único y task_assigned apagado no avisa", async () => {
    const saved = await alex.services.auth.updateProfile({
      name: "Alex",
      username: "Alex.Demo",
      bio: "Colaborador de demostración",
    });
    expect(saved).toMatchObject({ id: ALEX, username: "alex.demo" });
    await expect(
      rober.services.auth.updateProfile({ name: "Rober", username: "ALEX.demo", bio: null }),
    ).rejects.toThrow("Ese usuario ya está en uso");

    await alex.services.notifications.updatePreferences({ taskAssigned: false });
    expect(await alex.services.notifications.getPreferences()).toMatchObject({
      taskAssigned: false,
      hoursReminder: true,
    });
    const title = `Sin aviso ${Date.now()}`;
    await admin.services.tasks.create({
      sprintId: null,
      projectId: "10000000-0000-4000-8000-000000000001",
      title,
      assigneeId: ALEX,
      estimateHours: null,
      link: null,
    });
    const own = await alex.services.notifications.list();
    expect(own.some((n) => n.payload.taskName === title)).toBe(false);
    await alex.services.notifications.updatePreferences({ taskAssigned: true });
  });

  it("segundo paso: el alta devuelve QR y secreto, y sin factor verificado no se pide el código", async () => {
    const enrollment = await alex.services.auth.enrollMfa();
    expect(enrollment.qrCodeSvg).toContain("svg");
    expect(enrollment.secret.length).toBeGreaterThan(10);
    expect(enrollment.uri).toMatch(/^otpauth:\/\//);
    expect(await alex.services.auth.getMfaChallenge()).toEqual({ required: false });
    const factors = await alex.services.auth.listMfaFactors();
    expect(factors.find((f) => f.id === enrollment.factorId)?.status).toBe("unverified");
    await alex.services.auth.disableMfa(enrollment.factorId);
    expect(await alex.services.auth.listMfaFactors()).toEqual([]);
  });

  it("horas con etiqueta y evidencia: la persona etiquetada las ve, la revisión fija 7 días y corregir los limpia", async () => {
    const yesterday = todayLima(new Date(Date.now() - 86_400_000));
    const created = await rober.services.time.addManual({
      taskId: null,
      date: yesterday,
      hours: 2,
      description: "Integración de etiquetas y evidencia",
      participants: [{ userId: ALEX, sharePercent: 50 }],
    });
    expect(created.participants).toEqual([{ userId: ALEX, sharePercent: 50 }]);

    const file = await rober.services.time.addEvidence(created.id, {
      name: "captura integración.pdf",
      type: "application/pdf",
      data: `data:application/pdf;base64,${btoa("evidencia")}`,
    });
    expect(file).toMatchObject({ mime: "application/pdf", size: 9, purged: false });

    // La persona etiquetada (colaborador) ve el registro, sus etiquetas y el archivo firmado.
    const seen = (await alex.services.time.listEntries()).find((e) => e.id === created.id);
    expect(seen?.participants).toHaveLength(1);
    expect(seen?.evidence?.map((f) => f.id)).toEqual([file.id]);
    expect(await alex.services.time.getEvidenceUrl(file.id)).toMatch(/^https?:\/\//);
    // Quien está etiquetado no revisa; quien no, sí.
    await expect(alex.services.time.validate([created.id])).rejects.toThrow();

    const [approved] = await admin.services.time.validate([created.id]);
    expect(approved.validated).toBe(true);
    const kept = approved.evidence![0];
    const days = (Date.parse(kept.purgeAt!) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);

    // Corregir las horas devuelve el registro a pendiente y limpia la fecha de retiro.
    const edited = await rober.services.time.update(created.id, { hours: 3 });
    expect(edited.validated).toBe(false);
    expect(edited.evidence![0].purgeAt ?? null).toBeNull();

    // Aún no vence: el barrido no retira nada y nunca falla.
    expect(await rober.services.time.purgeExpiredEvidence()).toBe(0);
    await rober.services.time.removeEvidence(file.id);
    expect((await rober.services.time.listEntries({ userId: ROBER })).find((e) => e.id === created.id)?.evidence)
      .toEqual([]);
    await rober.services.time.void(created.id, "Prueba de integración");
  });
  it("comparte el daily: un envío por día, visible para socios y solo propio para el colaborador", async () => {
    const today = todayLima();
    const first = await rober.services.daily.submit({ done: "  Avance de integración ", willDo: "Seguir", blockers: "" });
    expect(first).toMatchObject({ userId: ROBER, date: today, done: "Avance de integración" });
    // Reenviar el mismo día corrige la misma fila.
    const second = await rober.services.daily.submit({ done: "Avance corregido", willDo: "Seguir", blockers: "Nada" });
    expect(second.id).toBe(first.id);
    expect(await rober.services.daily.list({ userId: ROBER, date: today })).toHaveLength(1);

    // El admin lo ve; el colaborador no ve el de otra persona, pero sí el suyo.
    const seenByAdmin = await admin.services.daily.list({ userId: ROBER, date: today });
    expect(seenByAdmin.map((d) => d.done)).toEqual(["Avance corregido"]);
    expect(await alex.services.daily.list({ userId: ROBER })).toEqual([]);
    await alex.services.daily.submit({ done: "Lo mío", willDo: "", blockers: "" });
    const mine = await alex.services.daily.list();
    expect(mine.every((d) => d.userId === ALEX)).toBe(true);
    expect(mine.length).toBeGreaterThan(0);

    // La base rechaza otra fecha aunque el cliente la mande, y nadie borra.
    const denied = await rober.client
      .from("daily_updates")
      .insert({ date: "2020-01-01", done: "viejo" });
    expect(denied.error).not.toBeNull();
    const removed = await rober.client.from("daily_updates").delete().eq("id", first.id);
    expect(removed.error).not.toBeNull();
    expect(typeof (await rober.services.daily.suggestDone())).toBe("string");
  });
});
