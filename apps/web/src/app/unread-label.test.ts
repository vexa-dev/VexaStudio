import { describe, expect, it } from "vitest";
import { unreadLabel } from "./unread-label";

describe("unreadLabel", () => {
  it("returns an empty label when there is nothing unread", () => {
    expect(unreadLabel(0)).toBe("");
  });

  it("returns the exact count from 1 to 9", () => {
    expect(unreadLabel(1)).toBe("1");
    expect(unreadLabel(9)).toBe("9");
  });

  it("caps the label above 9", () => {
    expect(unreadLabel(10)).toBe("9+");
    expect(unreadLabel(250)).toBe("9+");
  });

  it("ignores negative, NaN and fractional-invalid values", () => {
    expect(unreadLabel(-3)).toBe("");
    expect(unreadLabel(Number.NaN)).toBe("");
  });
});
