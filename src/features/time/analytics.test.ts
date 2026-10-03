import { describe, it, expect } from "vitest";
import type { TimeEntry } from "@/domain/types";
import { monthlyActivity } from "./analytics";
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
