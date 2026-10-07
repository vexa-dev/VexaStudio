import { beforeEach, describe, expect, it } from "vitest";
import { getDb, setSessionUserId } from "./db";
import { createMockServices, resetMock as resetAllMock } from "./index";

const services = createMockServices();

beforeEach(() => {
  resetAllMock();
  setSessionUserId("u-rober");
});

describe("preferencias de notificación (mock)", () => {
  it("sin guardar nada, todo está activado", async () => {
    expect(await services.notifications.getPreferences()).toEqual({
      taskAssigned: true,
      hoursReminder: true,
      weeklySummary: true,
    });
  });

  it("cambia solo lo indicado y lo conserva", async () => {
    const saved = await services.notifications.updatePreferences({ taskAssigned: false });
    expect(saved).toEqual({ taskAssigned: false, hoursReminder: true, weeklySummary: true });
    await services.notifications.updatePreferences({ weeklySummary: false });
    expect(await services.notifications.getPreferences()).toEqual({
      taskAssigned: false,
      hoursReminder: true,
      weeklySummary: false,
    });
  });

  it("cada persona tiene las suyas", async () => {
    await services.notifications.updatePreferences({ hoursReminder: false });
    setSessionUserId("u-diego");
    expect((await services.notifications.getPreferences()).hoursReminder).toBe(true);
  });

  it("sin sesión pide iniciar sesión", async () => {
    setSessionUserId(null);
    await expect(services.notifications.getPreferences()).rejects.toThrow(
      "Inicia sesión para continuar",
    );
  });

});

describe("avisos (mock)", () => {
  beforeEach(() => {
    getDb().notifications = [];
  });

  function seed(userId: string, id: string, createdAt: string, read = false) {
    getDb().notifications.push({
      id,
      userId,
      type: "mention",
      payload: { title: id },
      read,
      createdAt,
    });
  }

  it("lista solo los avisos propios, del más nuevo al más viejo", async () => {
    seed("u-rober", "n-viejo", "2026-10-01T10:00:00.000Z");
    seed("u-diego", "n-ajeno", "2026-10-02T10:00:00.000Z");
    seed("u-rober", "n-nuevo", "2026-10-03T10:00:00.000Z");
    const list = await services.notifications.list();
    expect(list.map((n) => n.id)).toEqual(["n-nuevo", "n-viejo"]);
  });

  it("sin sesión pide iniciar sesión", async () => {
    setSessionUserId(null);
    await expect(services.notifications.list()).rejects.toThrow("Inicia sesión para continuar");
  });

  it("markRead marca solo ese aviso y es idempotente", async () => {
    seed("u-rober", "n-1", "2026-10-01T10:00:00.000Z");
    seed("u-rober", "n-2", "2026-10-02T10:00:00.000Z");
    await services.notifications.markRead("n-1");
    await services.notifications.markRead("n-1");
    const byId = Object.fromEntries((await services.notifications.list()).map((n) => [n.id, n.read]));
    expect(byId).toEqual({ "n-1": true, "n-2": false });
  });

  it("markRead rechaza un aviso que no es de la persona", async () => {
    seed("u-diego", "n-ajeno", "2026-10-02T10:00:00.000Z");
    await expect(services.notifications.markRead("n-ajeno")).rejects.toThrow(
      "El aviso no existe o no es tuyo",
    );
    await expect(services.notifications.markRead("n-inexistente")).rejects.toThrow(
      "El aviso no existe o no es tuyo",
    );
  });

  it("markAllRead marca los propios y no toca los ajenos", async () => {
    seed("u-rober", "n-1", "2026-10-01T10:00:00.000Z");
    seed("u-diego", "n-ajeno", "2026-10-02T10:00:00.000Z");
    await services.notifications.markAllRead();
    await services.notifications.markAllRead();
    expect((await services.notifications.list()).every((n) => n.read)).toBe(true);
    setSessionUserId("u-diego");
    expect((await services.notifications.list())[0]?.read).toBe(false);
  });

  it("muestra el aviso de mención que genera un comentario", async () => {
    setSessionUserId("u-jose");
    await services.comments.add({
      entity: "task",
      entityId: "t-5",
      text: "@rober revisa esto",
      mentions: ["u-rober"],
    });
    setSessionUserId("u-rober");
    const list = await services.notifications.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ type: "mention", userId: "u-rober", read: false });
  });
});
