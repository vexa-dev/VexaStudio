import { describe, expect, it } from "vitest";
import {
  fieldLabel,
  formatFieldValue,
  truncateText,
} from "./format-value";

describe("fieldLabel", () => {
  it("translates known fields", () => {
    expect(fieldLabel("status")).toBe("Estado");
    expect(fieldLabel("estimateHours")).toBe("Estimación (h)");
  });
  it("humanizes unknown camelCase fields", () => {
    expect(fieldLabel("someNewField")).toBe("Some new field");
  });
});

describe("formatFieldValue", () => {
  it("shows an em dash for empty values", () => {
    expect(formatFieldValue("title", null)).toBe("—");
    expect(formatFieldValue("title", undefined)).toBe("—");
    expect(formatFieldValue("title", "")).toBe("—");
  });
  it("translates statuses and roles", () => {
    expect(formatFieldValue("status", "in_progress")).toBe("En progreso");
    expect(formatFieldValue("role", "partner")).toBe("Socio");
  });
  it("renders booleans and numbers in Spanish", () => {
    expect(formatFieldValue("validated", true)).toBe("Sí");
    expect(formatFieldValue("validated", false)).toBe("No");
    expect(formatFieldValue("hours", 1.5)).toBe("1.5");
  });
  it("converts ISO instants to Lima time with seconds", () => {
    expect(formatFieldValue("startedAt", "2026-10-02T15:04:05.000Z")).toBe(
      "02/10/2026 10:04:05",
    );
  });
  it("resolves member ids through the provided lookup", () => {
    const name = (id: string) => (id === "u1" ? "Rober Vasquez" : undefined);
    expect(formatFieldValue("assigneeId", "u1", name)).toBe("Rober Vasquez");
    expect(formatFieldValue("assigneeId", "u9", name)).toBe("u9");
  });
  it("lists arrays of primitives and named objects", () => {
    expect(formatFieldValue("memberIds", ["a", "b"])).toBe("a, b");
    expect(
      formatFieldValue("labels", [{ id: "1", name: "Bug" }, { name: "UI" }]),
    ).toBe("Bug, UI");
    expect(formatFieldValue("labels", [])).toBe("—");
  });
  it("renders unknown objects as compact JSON", () => {
    expect(formatFieldValue("dailyReminder", { time: "21:00" })).toBe(
      '{"time":"21:00"}',
    );
  });
});

describe("truncateText", () => {
  it("keeps short text intact", () => {
    expect(truncateText("hola", 10)).toEqual({ text: "hola", truncated: false });
  });
  it("cuts long text and flags it", () => {
    expect(truncateText("abcdefghij", 5)).toEqual({
      text: "abcde…",
      truncated: true,
    });
  });
});
