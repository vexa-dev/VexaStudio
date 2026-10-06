import { describe, it, expect } from "vitest";
import {
  creditExample,
  hasParticipantErrors,
  participantErrors,
  sameParticipants,
} from "./participants";

describe("participantes etiquetados", () => {
  it("explica el crédito con un ejemplo", () => {
    expect(creditExample(2, 75, "Rober")).toBe("2 h al 75 % = 1.5 h para Rober");
    expect(creditExample(undefined, 50, "Rober")).toBe(
      "50 % de las horas para Rober",
    );
    expect(creditExample(2, Number.NaN, "Rober")).toBe("");
  });
  it("reporta errores por fila y de lista", () => {
    const errors = participantErrors("me", [
      { userId: "a", sharePercent: 100 },
      { userId: "a", sharePercent: 0 },
      { userId: "me", sharePercent: 100 },
    ]);
    expect(errors.rows[1]).toBeDefined();
    expect(errors.rows[2]).toBe("No puedes etiquetarte a ti mismo");
    expect(hasParticipantErrors(errors)).toBe(true);
    expect(
      hasParticipantErrors(
        participantErrors("me", [{ userId: "a", sharePercent: 50 }]),
      ),
    ).toBe(false);
  });
  it("compara listas sin importar el orden y con 100 por defecto", () => {
    expect(
      sameParticipants(
        [{ userId: "a" }, { userId: "b", sharePercent: 50 }],
        [{ userId: "b", sharePercent: 50 }, { userId: "a", sharePercent: 100 }],
      ),
    ).toBe(true);
    expect(
      sameParticipants([{ userId: "a", sharePercent: 50 }], [{ userId: "a" }]),
    ).toBe(false);
  });
});
