import { describe, expect, it } from "vitest";
import { PASSWORD_MIN_LENGTH, normalizeEmail, passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("acepta una contraseña que cumple la política", () => {
    expect(passwordProblem("Vexa-Studio-2026")).toBeNull();
  });

  it("exige el mínimo de caracteres primero", () => {
    expect(passwordProblem("Abc1")).toBe(
      `La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    );
  });

  it("exige minúscula, mayúscula y número", () => {
    expect(passwordProblem("ABCDEFGHIJKL1")).toBe("La contraseña debe incluir al menos una minúscula.");
    expect(passwordProblem("abcdefghijkl1")).toBe("La contraseña debe incluir al menos una mayúscula.");
    expect(passwordProblem("Abcdefghijklm")).toBe("La contraseña debe incluir al menos un número.");
  });
});

describe("normalizeEmail", () => {
  it("recorta y pasa a minúsculas", () => {
    expect(normalizeEmail("  Jhony@Vexa.TEST ")).toBe("jhony@vexa.test");
  });

  it("rechaza vacío, sin arroba o demasiado largo", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("sin-arroba")).toBeNull();
    expect(normalizeEmail("a b@vexa.test")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@v.co`)).toBeNull();
  });
});
