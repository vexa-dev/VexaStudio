import { describe, it, expect } from "vitest";
import type { TimeEntry } from "@vexa/domain/types";
import {
  creditedActivity,
  creditedHours,
  entriesVisibleTo,
  isTaggedIn,
  monthlyActivity,
} from "./analytics";
const base: TimeEntry = {
  id: "a",
  userId: "u",
  taskId: null,
  startedAt: "2026-09-30T23:30:00-05:00",
  endedAt: "2026-10-01T01:30:00-05:00",
  hours: 2,
  source: "manual",
  paid: false,
  validated: true,
  validatedAt: null,
  createdAt: "2026-10-01T08:00:00Z",
  voidedAt: null,
  voidReason: null,
};
describe("actividad mensual en Lima", () => {
  it("reparte intervalos entre horas y recorta el cambio de mes", () => {
    const s = monthlyActivity([base], "2026-10");
    expect(s.total).toBe(1.5);
    expect(s.approved).toBe(1.5);
    expect(s.hourly[0]).toBe(1);
    expect(s.hourly[1]).toBe(0.5);
    expect(s.daily[0]).toBe(1.5);
  });
  it("incluye registros anteriores en el total sin inventar su horario", () => {
    const s = monthlyActivity(
      [{ ...base, source: undefined, startedAt: "2026-10-02T12:00:00-05:00" }],
      "2026-10",
    );
    expect(s.total).toBe(2);
    expect(s.timedHours).toBe(0);
    expect(s.hourly.every((h) => h === 0)).toBe(true);
  });
  it("excluye anulados y temporizadores abiertos", () => {
    expect(
      monthlyActivity(
        [
          { ...base, voidedAt: base.createdAt },
          { ...base, endedAt: null },
        ],
        "2026-10",
      ).total,
    ).toBe(0);
  });
});

describe("crédito por persona", () => {
  const tagged: TimeEntry = {
    ...base,
    id: "t",
    userId: "owner",
    startedAt: "2026-10-02T10:00:00-05:00",
    endedAt: "2026-10-02T12:00:00-05:00",
    participants: [{ userId: "u", sharePercent: 75 }],
  };
  it("sin etiquetas el resultado es idéntico a monthlyActivity", () => {
    const own = { ...base, userId: "u" };
    expect(creditedActivity([own], "u", "2026-10")).toEqual(
      monthlyActivity([own], "2026-10"),
    );
  });
  it("suma al etiquetado su porcentaje solo cuando el registro está validado", () => {
    expect(creditedActivity([tagged], "u", "2026-10").total).toBe(1.5);
    expect(
      creditedActivity([{ ...tagged, validated: false }], "u", "2026-10").total,
    ).toBe(0);
    expect(creditedActivity([tagged], "owner", "2026-10").total).toBe(2);
  });
  it("calcula las horas acreditadas para mostrar", () => {
    expect(creditedHours(tagged, "u")).toBe(1.5);
    expect(creditedHours(tagged, "owner")).toBe(2);
    expect(creditedHours(tagged, "x")).toBe(0);
  });
  it("lista los propios y aquellos donde la persona fue etiquetada", () => {
    const other = { ...tagged, id: "o", participants: [] };
    const voided = { ...tagged, id: "v", voidedAt: "2026-10-03T00:00:00Z" };
    expect(
      entriesVisibleTo([tagged, other, voided], "u").map((e) => e.id),
    ).toEqual(["t"]);
  });
  it("impide aprobar horas donde la persona participa", () => {
    expect(isTaggedIn(tagged, "u")).toBe(true);
    expect(isTaggedIn(tagged, "owner")).toBe(false);
  });
});
