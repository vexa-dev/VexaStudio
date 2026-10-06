import { describe, expect, it } from "vitest";
import type { TimeEntry } from "@vexa/domain/types";
import { lastEndOnDate } from "./last-end";

let n = 0;
function entry(patch: Partial<TimeEntry>): TimeEntry {
  n += 1;
  return {
    id: `e${n}`,
    userId: "u1",
    taskId: null,
    startedAt: "2026-10-05T14:00:00.000Z",
    endedAt: "2026-10-05T16:00:00.000Z",
    hours: 2,
    paid: false,
    validated: false,
    validatedAt: null,
    createdAt: "2026-10-05T16:00:00.000Z",
    voidedAt: null,
    voidReason: null,
    ...patch,
  };
}

describe("lastEndOnDate", () => {
  it("returns null without entries", () => {
    expect(lastEndOnDate([], "2026-10-05", "u1")).toBeNull();
  });

  it("converts the end to Lima wall-clock time", () => {
    // 16:00Z is 11:00 in Lima.
    expect(lastEndOnDate([entry({})], "2026-10-05", "u1")).toEqual({
      hour24: 11,
      minute: 0,
    });
  });

  it("keeps minutes", () => {
    const e = entry({ endedAt: "2026-10-05T18:45:00.000Z" });
    expect(lastEndOnDate([e], "2026-10-05", "u1")).toEqual({
      hour24: 13,
      minute: 45,
    });
  });

  it("picks the latest of several", () => {
    const list = [
      entry({ endedAt: "2026-10-05T15:00:00.000Z" }),
      entry({ endedAt: "2026-10-05T20:30:00.000Z" }),
      entry({ endedAt: "2026-10-05T17:00:00.000Z" }),
    ];
    expect(lastEndOnDate(list, "2026-10-05", "u1")).toEqual({
      hour24: 15,
      minute: 30,
    });
  });

  it("ignores other users", () => {
    expect(
      lastEndOnDate([entry({ userId: "u2" })], "2026-10-05", "u1"),
    ).toBeNull();
  });

  it("ignores voided entries and drafts", () => {
    const list = [
      entry({ voidedAt: "2026-10-05T17:00:00.000Z" }),
      entry({ draft: true }),
    ];
    expect(lastEndOnDate(list, "2026-10-05", "u1")).toBeNull();
  });

  it("ignores open entries without an end", () => {
    expect(
      lastEndOnDate([entry({ endedAt: null })], "2026-10-05", "u1"),
    ).toBeNull();
  });

  it("excludes an entry that ended after midnight Lima on the next day", () => {
    // 05:30Z on the 6th is 00:30 Lima on the 6th.
    const e = entry({ endedAt: "2026-10-06T05:30:00.000Z" });
    expect(lastEndOnDate([e], "2026-10-05", "u1")).toBeNull();
    expect(lastEndOnDate([e], "2026-10-06", "u1")).toEqual({
      hour24: 0,
      minute: 30,
    });
  });

  it("includes an end late in the evening Lima although it is the next UTC day", () => {
    // 03:00Z on the 6th is 22:00 Lima on the 5th.
    const e = entry({ endedAt: "2026-10-06T03:00:00.000Z" });
    expect(lastEndOnDate([e], "2026-10-05", "u1")).toEqual({
      hour24: 22,
      minute: 0,
    });
  });
});
