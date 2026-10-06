import { beforeEach, describe, expect, it } from "vitest";
import { monthKey, todayLima } from "@vexa/domain/dates";
import { getDb, resetMock, setSessionUserId } from "./db";
import { summarizeMonth, summarizePoints } from "./dashboard";
import { time } from "./work";

const ROBER = "u-rober";
const JOSE = "u-jose";
const DIEGO = "u-diego";
const ALEX = "u-demo-collaborator";

/** Yesterday (Lima): a 4 h edit of a noon entry still ends in the past. */
const YESTERDAY = todayLima(new Date(Date.now() - 86_400_000));

const PDF = (text = "hola") => ({
  name: "informe.pdf",
  type: "application/pdf",
  data: `data:application/pdf;base64,${btoa(text)}`,
});

beforeEach(() => {
  resetMock();
  setSessionUserId(JOSE);
});

async function entryWithTags(hours = 2) {
  return time.addManual({
    taskId: null,
    description: "Trabajo de prueba con apoyo",
    date: YESTERDAY,
    hours,
    participants: [{ userId: ROBER, sharePercent: 75 }, { userId: ALEX }],
  });
}

const as = (userId: string) => setSessionUserId(userId);
const entry = (id: string) => getDb().timeEntries.find((e) => e.id === id)!;
const summary = (userId: string) =>
  summarizeMonth(monthKey(new Date(`${YESTERDAY}T12:00:00-05:00`))).find((s) => s.userId === userId)!;
const points = (userId: string) =>
  summarizePoints().find((p) => p.userId === userId)!;

describe("etiquetas", () => {
  it("al registrar se guardan con su porcentaje (100 por defecto) y todo registro trae las listas", async () => {
    const created = await entryWithTags();
    expect(created.participants).toEqual([
      { userId: ROBER, sharePercent: 75 },
      { userId: ALEX, sharePercent: 100 },
    ]);
    expect(created.evidence).toEqual([]);
    const plain = await time.addManual({
      taskId: null,
      description: "Otro trabajo sin apoyo",
      date: YESTERDAY,
      hours: 1,
    });
    expect(plain.participants).toEqual([]);
    expect(getDb().timeEntries.every((e) => Array.isArray(e.participants))).toBe(true);
  });

  it("valida autoetiqueta, duplicados, porcentaje y personas inactivas", async () => {
    const base = { taskId: null, description: "Trabajo de prueba con apoyo", date: YESTERDAY, hours: 1 };
    await expect(time.addManual({ ...base, participants: [{ userId: JOSE }] })).rejects.toThrow(
      "No puedes etiquetarte a ti mismo",
    );
    await expect(
      time.addManual({ ...base, participants: [{ userId: ROBER }, { userId: ROBER }] }),
    ).rejects.toThrow("No repitas a una persona");
    await expect(
      time.addManual({ ...base, participants: [{ userId: ROBER, sharePercent: 101 }] }),
    ).rejects.toThrow("entre 1 y 100");
    await expect(time.addManual({ ...base, participants: [{ userId: "nadie" }] })).rejects.toThrow(
      "no está disponible",
    );
    expect(getDb().timeEntries.filter((e) => e.description === base.description)).toHaveLength(0);
  });

  it("solo el dueño cambia las etiquetas y deja la edición en la auditoría", async () => {
    const created = await entryWithTags();
    const updated = await time.setParticipants(created.id, [{ userId: DIEGO, sharePercent: 50 }]);
    expect(updated.participants).toEqual([{ userId: DIEGO, sharePercent: 50 }]);
    expect(
      getDb().auditLog.some(
        (a) =>
          a.entity.id === created.id &&
          a.eventType === "hours.edited" &&
          a.changes.some((c) => c.field === "participants"),
      ),
    ).toBe(true);
    as(ROBER);
    await expect(time.setParticipants(created.id, [])).rejects.toThrow("propios");
    as(JOSE);
    await expect(time.setParticipants(created.id, [])).resolves.toMatchObject({ participants: [] });
  });

  it("no cambia etiquetas de un registro pagado, anulado o fuera de la ventana", async () => {
    const created = await entryWithTags();
    entry(created.id).paid = true;
    await expect(time.setParticipants(created.id, [])).rejects.toThrow("ya no se puede editar");
    entry(created.id).paid = false;
    entry(created.id).createdAt = new Date(Date.now() - 30 * 86_400_000).toISOString();
    await expect(time.setParticipants(created.id, [])).rejects.toThrow("ya no se puede editar");
    entry(created.id).createdAt = new Date().toISOString();
    await time.void(created.id, "Registro duplicado");
    await expect(time.setParticipants(created.id, [])).rejects.toThrow("ya no se puede editar");
  });

  it("quien está etiquetado no aprueba ni pide aclaración; otro socio sí aprueba", async () => {
    const created = await entryWithTags();
    as(ROBER);
    await expect(time.validate([created.id])).rejects.toThrow("en las que estás etiquetado");
    await expect(time.requestClarification(created.id, "Falta el detalle completo")).rejects.toThrow(
      "en las que estás etiquetado",
    );
    as(DIEGO);
    await expect(time.validate([created.id])).resolves.toHaveLength(1);
    expect(entry(created.id).validated).toBe(true);
  });

  it("la persona etiquetada, incluso un colaborador, ve el registro en el historial", async () => {
    const created = await entryWithTags();
    as(ALEX);
    const ids = (await time.listEntries()).map((e) => e.id);
    expect(ids).toContain(created.id);
  });
});

describe("conteo de horas acreditadas", () => {
  it("sin revisar solo suma el dueño; al aprobar, la persona etiquetada suma su porcentaje", async () => {
    const roberHours = summary(ROBER).hours;
    const joseHours = summary(JOSE).hours;
    const robertPoints = points(ROBER).hourPoints;
    const josePoints = points(JOSE).hourPoints;
    const created = await entryWithTags(2);
    expect(summary(JOSE).hours - joseHours).toBeCloseTo(2);
    expect(summary(ROBER).hours - roberHours).toBe(0);
    as(DIEGO);
    await time.validate([created.id]);
    expect(summary(ROBER).hours - roberHours).toBeCloseTo(1.5);
    expect(summary(JOSE).hours - joseHours).toBeCloseTo(2);
    expect(points(ROBER).hourPoints - robertPoints).toBeCloseTo(30);
    expect(points(JOSE).hourPoints - josePoints).toBeCloseTo(40);
  });

  it("un registro pagado no da puntos a nadie pero sí cuenta para el mínimo de la persona etiquetada", async () => {
    const before = { hours: summary(ROBER).hours, points: points(ROBER).hourPoints };
    const created = await entryWithTags(2);
    as(DIEGO);
    await time.validate([created.id]);
    entry(created.id).paid = true;
    expect(points(ROBER).hourPoints).toBeCloseTo(before.points);
    expect(summary(ROBER).hours - before.hours).toBeCloseTo(1.5);
  });

  it("corregir la aprobación retira el crédito de las personas etiquetadas", async () => {
    const before = points(ROBER).hourPoints;
    const hoursBefore = summary(ROBER).hours;
    const created = await entryWithTags(2);
    as(DIEGO);
    await time.validate([created.id]);
    as(JOSE);
    await time.update(created.id, { hours: 4 });
    expect(entry(created.id).validated).toBe(false);
    expect(points(ROBER).hourPoints - before).toBe(0);
    expect(summary(ROBER).hours - hoursBefore).toBe(0);
    as(DIEGO);
    await time.validate([created.id]);
    expect(points(ROBER).hourPoints - before).toBeCloseTo(60); // 4 h x 75 % x 20
  });

  it("un registro anulado no cuenta para nadie", async () => {
    const before = summary(ROBER).hours;
    const created = await entryWithTags(2);
    await time.void(created.id, "Registro duplicado");
    expect(summary(ROBER).hours).toBe(before);
  });
});

describe("evidencia", () => {
  it("el dueño adjunta un archivo; lo ve quien ve el registro y no quien no lo ve", async () => {
    const created = await entryWithTags();
    const file = await time.addEvidence(created.id, PDF());
    expect(file).toMatchObject({ name: "informe.pdf", mime: "application/pdf", size: 4, purged: false });
    expect(entry(created.id).evidence).toHaveLength(1);
    expect(await time.getEvidenceUrl(file.id)).toMatch(/^data:application\/pdf;base64,/);
    as(ROBER);
    await expect(time.getEvidenceUrl(file.id)).resolves.toBeTruthy();
    as(ALEX);
    await expect(time.getEvidenceUrl(file.id)).resolves.toBeTruthy();
    const plain = await (async () => {
      as(JOSE);
      return time.addManual({ taskId: null, description: "Registro sin etiquetas", date: YESTERDAY, hours: 1 });
    })();
    const secret = await time.addEvidence(plain.id, PDF("secreto"));
    as(ALEX);
    await expect(time.getEvidenceUrl(secret.id)).rejects.toThrow();
    as(ROBER);
    await expect(time.addEvidence(created.id, PDF())).rejects.toThrow("propios");
  });

  it("valida tipo, peso y máximo de 5 archivos", async () => {
    const created = await entryWithTags();
    await expect(
      time.addEvidence(created.id, { name: "a.svg", type: "image/svg+xml", data: "data:image/svg+xml;base64,AAAA" }),
    ).rejects.toThrow("no está permitido");
    await expect(
      time.addEvidence(created.id, { name: "a.pdf", type: "application/pdf", data: "texto cualquiera" }),
    ).rejects.toThrow("no es válido");
    const big = `data:application/pdf;base64,${"A".repeat(4 * 1024 * 1024 + 8)}`;
    await expect(time.addEvidence(created.id, { name: "a.pdf", type: "application/pdf", data: big })).rejects.toThrow(
      "pesa demasiado",
    );
    for (let i = 0; i < 5; i++) await time.addEvidence(created.id, PDF(`n${i}`));
    await expect(time.addEvidence(created.id, PDF())).rejects.toThrow("hasta 5 archivos");
  });

  it("al validar se guarda 7 días; al corregir se limpia; al anular vence de inmediato", async () => {
    const created = await entryWithTags();
    const file = await time.addEvidence(created.id, PDF());
    expect(file.purgeAt ?? null).toBeNull();
    as(DIEGO);
    await time.validate([created.id]);
    const purgeAt = Date.parse(entry(created.id).evidence![0].purgeAt!);
    expect(purgeAt - Date.now()).toBeGreaterThan(6.99 * 86_400_000);
    expect(purgeAt - Date.now()).toBeLessThan(7.01 * 86_400_000);
    as(JOSE);
    await time.update(created.id, { hours: 3 });
    expect(entry(created.id).evidence![0].purgeAt ?? null).toBeNull();
    const second = await time.addManual({ taskId: null, description: "Registro para anular", date: YESTERDAY, hours: 1 });
    await time.addEvidence(second.id, PDF("otro"));
    await time.void(second.id, "Se registró por error");
    expect(Date.parse(entry(second.id).evidence![0].purgeAt!)).toBeLessThanOrEqual(Date.now());
  });

  it("agregar o quitar evidencia de un registro aprobado lo devuelve a pendiente", async () => {
    const created = await entryWithTags();
    const first = await time.addEvidence(created.id, PDF());
    as(DIEGO);
    await time.validate([created.id]);
    as(JOSE);
    await time.addEvidence(created.id, PDF("dos"));
    expect(entry(created.id).validated).toBe(false);
    as(DIEGO);
    await time.validate([created.id]);
    as(JOSE);
    await time.removeEvidence(first.id);
    expect(entry(created.id).validated).toBe(false);
    expect(entry(created.id).evidence).toHaveLength(1);
    as(ROBER);
    await expect(time.removeEvidence(entry(created.id).evidence![0].id)).rejects.toThrow("propios");
  });

  it("el barrido retira lo vencido, deja el marcador y no falla nunca", async () => {
    const created = await entryWithTags();
    const file = await time.addEvidence(created.id, PDF());
    await time.addEvidence(created.id, PDF("vigente"));
    as(DIEGO);
    await time.validate([created.id]);
    expect(await time.purgeExpiredEvidence()).toBe(0);
    entry(created.id).evidence![0].purgeAt = new Date(Date.now() - 60_000).toISOString();
    expect(await time.purgeExpiredEvidence()).toBe(1);
    expect(entry(created.id).evidence![0]).toMatchObject({ id: file.id, purged: true, name: "informe.pdf" });
    expect(entry(created.id).evidence![1].purged).toBe(false);
    await expect(time.getEvidenceUrl(file.id)).rejects.toThrow("ya fue eliminado");
    expect(await time.purgeExpiredEvidence()).toBe(0);
    setSessionUserId(null);
    expect(await time.purgeExpiredEvidence()).toBe(0);
  });

});
