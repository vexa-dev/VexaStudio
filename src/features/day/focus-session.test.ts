import { describe, expect, it } from "vitest";
import { isFocusSession, isResting, type FocusSession } from "./focus-session";

const rest: FocusSession = {
  mode: "break",
  minutes: 5,
  remaining: 300,
  deadline: null,
  completed: false,
};
describe("personal break state", () => {
  it("rests when selected or paused, but not after completion", () => {
    expect(isResting(rest, 1000)).toBe(true);
    expect(isResting({ ...rest, remaining: 60 }, 1000)).toBe(true);
    expect(isResting({ ...rest, completed: true }, 1000)).toBe(false);
    expect(isResting({ ...rest, remaining: 0 }, 1000)).toBe(false);
    expect(isResting({ ...rest, mode: "focus" }, 1000)).toBe(false);
  });
  it("ends a running break at the saved deadline even outside Mi día", () => {
    expect(isResting({ ...rest, deadline: 2000 }, 1999)).toBe(true);
    expect(isResting({ ...rest, deadline: 2000 }, 2000)).toBe(false);
    expect(isResting({ ...rest, deadline: 2000 }, 5000)).toBe(false);
  });
  it("rejects invalid saved durations and timer values", () => {
    expect(isFocusSession(rest)).toBe(true);
    expect(
      isFocusSession({ ...rest, mode: "focus", minutes: 25, remaining: 1500 }),
    ).toBe(true);
    for (const value of [
      null,
      {},
      { ...rest, minutes: 25 },
      { ...rest, remaining: -1 },
      { ...rest, remaining: 301 },
      { ...rest, deadline: Infinity },
      { ...rest, completed: "false" },
    ])
      expect(isFocusSession(value)).toBe(false);
  });
});
