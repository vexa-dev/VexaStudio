import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  toAuditFilter,
  type ActivityFilterState,
} from "./filter-state";
import { CATEGORY_EVENT_TYPES } from "./event-copy";

const state = (patch: Partial<ActivityFilterState>): ActivityFilterState => ({
  ...EMPTY_FILTERS,
  ...patch,
});

describe("toAuditFilter", () => {
  it("returns an empty filter when nothing is selected", () => {
    expect(toAuditFilter(EMPTY_FILTERS)).toEqual({});
  });
  it("maps person and project", () => {
    expect(toAuditFilter(state({ actorId: "u1", projectId: "p1" }))).toEqual({
      actorId: "u1",
      projectId: "p1",
    });
  });
  it("expands a category into its event types", () => {
    expect(toAuditFilter(state({ category: "hours" })).eventTypes).toEqual(
      CATEGORY_EVENT_TYPES.hours,
    );
  });
  it("covers whole Lima days in the date range", () => {
    expect(
      toAuditFilter(state({ from: "2026-10-02", to: "2026-10-02" })),
    ).toEqual({
      from: "2026-10-02T05:00:00.000Z",
      to: "2026-10-03T04:59:59.999Z",
    });
  });
  it("accepts a single open end", () => {
    expect(toAuditFilter(state({ from: "2026-10-02" }))).toEqual({
      from: "2026-10-02T05:00:00.000Z",
    });
  });
});

describe("countActiveFilters", () => {
  it("counts a date range as one filter", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(
      countActiveFilters(
        state({ actorId: "u1", category: "tasks", from: "2026-10-01", to: "2026-10-02" }),
      ),
    ).toBe(3);
    expect(countActiveFilters(state({ to: "2026-10-02" }))).toBe(1);
  });
});
