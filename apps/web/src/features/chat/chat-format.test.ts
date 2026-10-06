import { describe, expect, it } from "vitest";
import { dayLabel, groupMessages, shortTime } from "./chat-format";

// Lima is UTC-5 all year: 2026-10-05T12:00 Lima = 17:00Z.
const now = Date.parse("2026-10-05T17:00:00Z");
const at = (iso: string) => Date.parse(iso);

describe("dayLabel", () => {
  it("labels the same Lima day as Hoy", () => {
    expect(dayLabel(at("2026-10-05T10:00:00Z"), now)).toBe("Hoy");
  });
  it("uses Lima time at the midnight boundary", () => {
    // 04:59Z is 23:59 of Oct 4 in Lima; 05:00Z is 00:00 of Oct 5.
    expect(dayLabel(at("2026-10-05T04:59:00Z"), now)).toBe("Ayer");
    expect(dayLabel(at("2026-10-05T05:00:00Z"), now)).toBe("Hoy");
  });
  it("labels the previous Lima day as Ayer", () => {
    expect(dayLabel(at("2026-10-04T20:00:00Z"), now)).toBe("Ayer");
  });
  it("uses dd/mm/yyyy for older days", () => {
    expect(dayLabel(at("2026-10-03T20:00:00Z"), now)).toBe("03/10/2026");
  });
  it("treats a UTC-tomorrow instant as Hoy when Lima is still today", () => {
    const lateLima = at("2026-10-06T03:00:00Z"); // 22:00 Oct 5 in Lima
    expect(dayLabel(lateLima, lateLima)).toBe("Hoy");
  });
});

describe("shortTime", () => {
  it("shows HH:mm for today in Lima", () => {
    expect(shortTime(at("2026-10-05T14:05:00Z"), now)).toBe("09:05");
  });
  it("shows Ayer for yesterday", () => {
    expect(shortTime(at("2026-10-04T20:00:00Z"), now)).toBe("Ayer");
  });
  it("shows dd/mm for older days", () => {
    expect(shortTime(at("2026-09-28T20:00:00Z"), now)).toBe("28/09");
  });
});

function msg(id: string, authorId: string, iso: string, deleted = false) {
  return { id, authorId, sentAt: at(iso), text: id, deleted, reactions: {} };
}

describe("groupMessages", () => {
  it("returns nothing for no messages", () => {
    expect(groupMessages([])).toEqual([]);
  });
  it("emits a day separator and one run for same-author messages", () => {
    const items = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u1", "2026-10-05T15:02:00Z"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["day", "run"]);
    const run = items[1];
    expect(run.kind === "run" && run.messages.map((m) => m.id)).toEqual([
      "a",
      "b",
    ]);
  });
  it("breaks the run on author change", () => {
    const items = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u2", "2026-10-05T15:01:00Z"),
    ]);
    expect(items.map((item) => item.kind)).toEqual(["day", "run", "run"]);
  });
  it("keeps a run at exactly the window and breaks just past it", () => {
    const edge = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u1", "2026-10-05T15:05:00Z"),
    ]);
    expect(edge.filter((item) => item.kind === "run")).toHaveLength(1);
    const past = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u1", "2026-10-05T15:05:01Z"),
    ]);
    expect(past.filter((item) => item.kind === "run")).toHaveLength(2);
  });
  it("measures the gap against the previous message, not the run start", () => {
    const items = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u1", "2026-10-05T15:04:00Z"),
      msg("c", "u1", "2026-10-05T15:08:00Z"),
    ]);
    expect(items.filter((item) => item.kind === "run")).toHaveLength(1);
  });
  it("breaks on Lima day change even within the window", () => {
    // 04:58Z and 05:01Z straddle Lima midnight, 3 minutes apart.
    const items = groupMessages([
      msg("a", "u1", "2026-10-05T04:58:00Z"),
      msg("b", "u1", "2026-10-05T05:01:00Z"),
    ]);
    expect(items.map((item) => item.kind)).toEqual([
      "day",
      "run",
      "day",
      "run",
    ]);
  });
  it("keeps a deleted message inside its run", () => {
    const items = groupMessages([
      msg("a", "u1", "2026-10-05T15:00:00Z"),
      msg("b", "u1", "2026-10-05T15:01:00Z", true),
      msg("c", "u1", "2026-10-05T15:02:00Z"),
    ]);
    const run = items[1];
    expect(run.kind === "run" && run.messages).toHaveLength(3);
  });
  it("honours a custom window", () => {
    const items = groupMessages(
      [
        msg("a", "u1", "2026-10-05T15:00:00Z"),
        msg("b", "u1", "2026-10-05T15:02:00Z"),
      ],
      60_000,
    );
    expect(items.filter((item) => item.kind === "run")).toHaveLength(2);
  });
});
