import { describe, expect, it } from "vitest";
import { dailyToDraft, draftToDaily, isDraftEmpty, matchesSent } from "./daily-form";

const sent = { id: "d", userId: "u", date: "2026-10-07", done: "a", willDo: "b", blockers: "c\nNecesito ayuda de: Rober" };

describe("daily form mapping", () => {
  it("maps the draft to the shared fields and joins the help request with the blockers", () => {
    expect(draftToDaily({ done: " a ", next: "b", blockers: "c", needsFrom: "Rober" })).toEqual({
      done: "a",
      willDo: "b",
      blockers: "c\nNecesito ayuda de: Rober",
    });
    expect(draftToDaily({ done: "a", next: "", blockers: "", needsFrom: "Rober" }).blockers).toBe("");
  });
  it("restores the draft from a sent daily and detects unsent changes", () => {
    const draft = dailyToDraft(sent);
    expect(draft).toEqual({ done: "a", next: "b", blockers: "c", needsFrom: "Rober" });
    expect(matchesSent(draft, sent)).toBe(true);
    expect(matchesSent({ ...draft, done: "otro" }, sent)).toBe(false);
  });
  it("knows when a draft is empty", () => {
    expect(isDraftEmpty({ done: " ", next: "", blockers: "" })).toBe(true);
    expect(isDraftEmpty({ done: "x", next: "", blockers: "" })).toBe(false);
  });
});
