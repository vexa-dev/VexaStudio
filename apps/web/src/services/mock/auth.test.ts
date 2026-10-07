import { beforeEach, describe, expect, it } from "vitest";
import { setSessionUserId } from "./db";
import { createMockServices, resetMock as resetAllMock } from "./index";

const services = createMockServices();
const UNAVAILABLE = "Disponible solo con la conexión a Supabase.";

beforeEach(() => {
  resetAllMock();
  setSessionUserId("u-rober");
});

describe("updateProfile (mock)", () => {
  it("guarda nombre, usuario y bio y los conserva al releer la sesión", async () => {
    const profile = await services.auth.updateProfile({
      name: "Rober V.",
      username: "  Rober.V ",
      bio: "Líder técnico",
    });
    expect(profile).toMatchObject({
      id: "u-rober",
      name: "Rober V.",
      username: "rober.v",
      bio: "Líder técnico",
    });
    expect(await services.auth.getSession()).toMatchObject({ username: "rober.v", bio: "Líder técnico" });
    expect((await services.members.get("u-rober"))?.username).toBe("rober.v");
  });

  it("no toca el rol ni las horas", async () => {
    const before = await services.auth.getSession();
    const after = await services.auth.updateProfile({ name: "Otro", username: null, bio: null });
    expect([after.role, after.weeklyHours, after.area]).toEqual([
      before?.role,
      before?.weeklyHours,
      before?.area,
    ]);
    expect(after.username).toBeNull();
  });

  it("el usuario es único sin distinguir mayúsculas", async () => {
    setSessionUserId("u-diego");
    await services.auth.updateProfile({ name: "Diego", username: "diego", bio: null });
    setSessionUserId("u-rober");
    await expect(
      services.auth.updateProfile({ name: "Rober", username: "DIEGO", bio: null }),
    ).rejects.toThrow("Ese usuario ya está en uso");
  });

  it("repetir el propio usuario no choca", async () => {
    await services.auth.updateProfile({ name: "Rober", username: "rober", bio: null });
    await expect(
      services.auth.updateProfile({ name: "Rober V.", username: "Rober", bio: null }),
    ).resolves.toMatchObject({ username: "rober" });
  });

  it.each([
    [{ name: "  ", username: null, bio: null }, "El nombre debe tener de 1 a 80 caracteres"],
    [{ name: "R", username: "ab", bio: null }, "El usuario debe tener de 3 a 30 caracteres"],
    [{ name: "R", username: "con espacio", bio: null }, "El usuario debe tener de 3 a 30 caracteres"],
    [{ name: "R", username: null, bio: "x".repeat(281) }, "La biografía puede tener hasta 280 caracteres"],
  ])("rechaza datos no válidos %#", async (input, message) => {
    await expect(services.auth.updateProfile(input)).rejects.toThrow(message);
  });

  it("sin sesión pide iniciar sesión", async () => {
    setSessionUserId(null);
    await expect(
      services.auth.updateProfile({ name: "R", username: null, bio: null }),
    ).rejects.toThrow("Inicia sesión para continuar");
  });
});

describe("funciones solo de Supabase (mock)", () => {
  it.each([
    ["updatePassword", () => services.auth.updatePassword({ currentPassword: "a", newPassword: "b" })],
    ["signOutOthers", () => services.auth.signOutOthers()],
    ["listSessions", () => services.auth.listSessions()],
    ["revokeSession", () => services.auth.revokeSession("s")],
    ["listMfaFactors", () => services.auth.listMfaFactors()],
    ["enrollMfa", () => services.auth.enrollMfa()],
    ["verifyMfaEnrollment", () => services.auth.verifyMfaEnrollment("f", "123456")],
    ["disableMfa", () => services.auth.disableMfa("f")],
    ["verifyMfaLogin", () => services.auth.verifyMfaLogin("f", "123456")],
  ])("%s avisa que requiere Supabase", async (_name, call) => {
    await expect(call()).rejects.toThrow(UNAVAILABLE);
  });

  it("getMfaChallenge nunca exige segundo paso", async () => {
    expect(await services.auth.getMfaChallenge()).toEqual({ required: false });
  });
});

describe("restablecer contraseña (mock)", () => {
  const MESSAGE = "El restablecimiento de contraseña solo funciona con Supabase.";

  it("avisa con honestidad y no simula correos", async () => {
    await expect(services.auth.requestPasswordReset?.("alex@vexa.test")).rejects.toThrow(MESSAGE);
    await expect(services.auth.completePasswordReset?.("Vexa-Studio-2026")).rejects.toThrow(MESSAGE);
  });
});
