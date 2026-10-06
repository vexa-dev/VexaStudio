import { beforeEach, describe, expect, it } from "vitest";
import { setSessionUserId } from "./db";
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

  it("el resto del servicio sigue pendiente en el mock", async () => {
    await expect(services.notifications.list()).rejects.toThrow("aún no está implementado");
  });
});
