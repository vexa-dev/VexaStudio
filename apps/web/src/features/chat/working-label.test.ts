import { describe, expect, it } from "vitest";
import { workingLabel } from "./working-label";

describe("workingLabel", () => {
  it("names project and task for a running timer", () => {
    expect(
      workingLabel({
        source: "timer",
        projectName: "Fivuza",
        taskTitle: "Login",
      }),
    ).toBe("Desarrollando Fivuza · Login");
  });
  it("omits the task when the timer has none", () => {
    expect(
      workingLabel({ source: "timer", projectName: "Fivuza", taskTitle: null }),
    ).toBe("Desarrollando Fivuza");
  });
  it("uses the pinned wording for a manual project", () => {
    expect(
      workingLabel({
        source: "manual",
        projectName: "Vantage",
        taskTitle: null,
      }),
    ).toBe("Trabaja en Vantage");
  });
  it("returns null without anything to show", () => {
    expect(workingLabel(null)).toBeNull();
    expect(
      workingLabel({ source: "timer", projectName: null, taskTitle: "Login" }),
    ).toBeNull();
  });
});
