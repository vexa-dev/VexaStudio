import { describe, expect, it } from "vitest";
import { groupByDay } from "./group-by-day";

const at = (occurredAt: string, id = occurredAt) => ({ id, occurredAt });
// 03/10/2026 12:00 en Lima.
const now = new Date("2026-10-03T17:00:00.000Z");

describe("groupByDay", () => {
  it("labels today, yesterday and older days", () => {
    const groups = groupByDay(
      [
        at("2026-10-03T16:00:00.000Z"),
        at("2026-10-02T20:00:00.000Z"),
        at("2026-09-30T15:00:00.000Z"),
      ],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hoy", "Ayer", "30/09/2026"]);
  });
  it("keeps the incoming newest-first order inside each day", () => {
    const groups = groupByDay(
      [
        at("2026-10-03T16:00:00.000Z", "b"),
        at("2026-10-03T15:00:00.000Z", "a"),
      ],
      now,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.id)).toEqual(["b", "a"]);
  });
  it("cuts days at midnight in Lima, not UTC", () => {
    // 04:59 UTC del 03/10 todavía es 23:59 del 02/10 en Lima.
    const groups = groupByDay(
      [at("2026-10-03T05:00:00.000Z"), at("2026-10-03T04:59:00.000Z")],
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Hoy", "Ayer"]);
  });
  it("returns nothing for an empty list", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
