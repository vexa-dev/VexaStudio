import { describe, expect, it } from "vitest";
import {
  DAILY_MAX_LENGTH,
  buildDoneSuggestion,
  normalizeDailyInput,
  upsertDailyUpdate,
  validateDailyInput,
  type DailyRecord,
} from "./daily";
import type { Task, TimeEntry } from "./types";

const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: "e",
  userId: "u1",
  taskId: null,
  startedAt: "2026-10-07T15:00:00.000Z",
  endedAt: "2026-10-07T16:00:00.000Z",
  hours: 1,
  paid: false,
  validated: false,
  validatedAt: null,
  createdAt: "2026-10-07T16:00:00.000Z",
  voidedAt: null,
  voidReason: null,
  ...over,
});
const task = (id: string, title: string): Task => ({
  id,
  sprintId: null,
  projectId: null,
  title,
  status: "in_progress",
  assigneeId: "u1",
  estimateHours: null,
  link: null,
});

describe("normalizeDailyInput / validateDailyInput", () => {
  it("trims, unifies line breaks and caps the length", () => {
    const out = normalizeDailyInput({
      done: "  uno\r\ndos  ",
      willDo: "x".repeat(DAILY_MAX_LENGTH + 10),
      blockers: "   ",
    });
    expect(out.done).toBe("uno\ndos");
    expect(out.willDo).toHaveLength(DAILY_MAX_LENGTH);
    expect(out.blockers).toBe("");
  });
  it("requires something done or planned", () => {
    expect(validateDailyInput({ done: " ", willDo: "", blockers: "x" })).toMatch(/qué hiciste/);
    expect(validateDailyInput({ done: "a", willDo: "", blockers: "" })).toBeNull();
    expect(validateDailyInput({ done: "", willDo: "b", blockers: "" })).toBeNull();
  });
});

describe("upsertDailyUpdate", () => {
  const base: DailyRecord = { id: "d1", userId: "u1", date: "2026-10-07", done: "a", willDo: "b", blockers: "" };
  it("creates one record when the person has none for that date", () => {
    const { updates, update } = upsertDailyUpdate([], "u1", "2026-10-07", { done: "x", willDo: "", blockers: "" }, "new", "2026-10-07T20:00:00.000Z");
    expect(updates).toHaveLength(1);
    expect(update).toMatchObject({ id: "new", userId: "u1", date: "2026-10-07", done: "x", updatedAt: "2026-10-07T20:00:00.000Z" });
  });
  it("replaces the same person and date, keeps the id and leaves others untouched", () => {
    const other: DailyRecord = { ...base, id: "d2", userId: "u2" };
    const { updates, update } = upsertDailyUpdate([base, other], "u1", "2026-10-07", { done: "nuevo", willDo: "", blockers: "" }, "ignored", "2026-10-07T21:00:00.000Z");
    expect(updates).toHaveLength(2);
    expect(update.id).toBe("d1");
    expect(update.done).toBe("nuevo");
    expect(updates.find((u) => u.id === "d2")).toEqual(other);
  });
  it("does not mutate the input list", () => {
    const list = [base];
    upsertDailyUpdate(list, "u1", "2026-10-07", { done: "z", willDo: "", blockers: "" }, "n", "2026-10-07T21:00:00.000Z");
    expect(list[0].done).toBe("a");
  });
});

describe("buildDoneSuggestion", () => {
  const tasks = [task("t1", "Reglas de puntos"), task("t2", "Login")];
  const today = "2026-10-07";
  it("lists the tasks worked since the last daily, without repeats", () => {
    const text = buildDoneSuggestion({
      userId: "u1",
      today,
      tasks,
      entries: [
        entry({ id: "1", taskId: "t1", startedAt: "2026-10-06T15:00:00.000Z" }),
        entry({ id: "2", taskId: "t1", startedAt: "2026-10-07T15:00:00.000Z" }),
        entry({ id: "3", taskId: "t2", startedAt: "2026-10-07T17:00:00.000Z" }),
        entry({ id: "old", taskId: "t2", startedAt: "2026-10-04T15:00:00.000Z" }),
      ],
      dailies: [{ id: "d", userId: "u1", date: "2026-10-04", done: "", willDo: "", blockers: "" }],
    });
    expect(text).toBe("• Reglas de puntos\n• Login");
  });
  it("ignores other people, voided, open and draft entries", () => {
    const text = buildDoneSuggestion({
      userId: "u1",
      today,
      tasks,
      dailies: [],
      entries: [
        entry({ id: "a", userId: "u2", taskId: "t1" }),
        entry({ id: "b", taskId: "t1", voidedAt: "2026-10-07T18:00:00.000Z" }),
        entry({ id: "c", taskId: "t1", endedAt: null }),
        entry({ id: "d", taskId: "t1", draft: true }),
      ],
    });
    expect(text).toBe("");
  });
  it("counts today's work again after sending today's daily, but not earlier days", () => {
    const text = buildDoneSuggestion({
      userId: "u1",
      today,
      tasks,
      entries: [
        entry({ id: "y", taskId: "t2", startedAt: "2026-10-06T15:00:00.000Z" }),
        entry({ id: "t", taskId: "t1", startedAt: "2026-10-07T15:00:00.000Z" }),
      ],
      dailies: [{ id: "d", userId: "u1", date: today, done: "", willDo: "", blockers: "" }],
    });
    expect(text).toBe("• Reglas de puntos");
  });
  it("falls back to the description, then to a generic label, and looks back 7 days with no daily", () => {
    const text = buildDoneSuggestion({
      userId: "u1",
      today,
      tasks,
      dailies: [],
      entries: [
        entry({ id: "1", description: "Reunión con prospecto", startedAt: "2026-10-05T15:00:00.000Z" }),
        entry({ id: "2", startedAt: "2026-10-06T15:00:00.000Z" }),
        entry({ id: "far", taskId: "t1", startedAt: "2026-09-20T15:00:00.000Z" }),
      ],
    });
    expect(text).toBe("• Reunión con prospecto\n• Trabajo del estudio");
  });
  it("uses the Lima date, not UTC, to decide the day", () => {
    // 2026-10-08T03:00Z is still 2026-10-07 22:00 in Lima.
    const text = buildDoneSuggestion({
      userId: "u1",
      today,
      tasks,
      dailies: [{ id: "d", userId: "u1", date: "2026-10-06", done: "", willDo: "", blockers: "" }],
      entries: [entry({ taskId: "t1", startedAt: "2026-10-08T03:00:00.000Z", endedAt: "2026-10-08T04:00:00.000Z" })],
    });
    expect(text).toBe("• Reglas de puntos");
  });
  it("caps the suggestion at the daily limit", () => {
    const many = Array.from({ length: 400 }, (_, i) => entry({ id: String(i), description: `Tarea número ${i} con texto largo` }));
    expect(buildDoneSuggestion({ userId: "u1", today, tasks, dailies: [], entries: many }).length).toBeLessThanOrEqual(DAILY_MAX_LENGTH);
  });
});
