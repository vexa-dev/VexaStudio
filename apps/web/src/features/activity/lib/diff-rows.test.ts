import { describe, expect, it } from "vitest";
import { clientLabel, diffRows } from "./diff-rows";

describe("diffRows", () => {
  it("labels fields and formats before and after values", () => {
    expect(
      diffRows([
        { field: "status", from: "todo", to: "in_progress" },
        { field: "estimateHours", from: null, to: 2 },
      ]),
    ).toEqual([
      { field: "status", label: "Estado", before: "Pendiente", after: "En progreso" },
      { field: "estimateHours", label: "Estimación (h)", before: "—", after: "2" },
    ]);
  });
  it("resolves ids through the lookup", () => {
    const rows = diffRows(
      [{ field: "assigneeId", from: "u1", to: "u2" }],
      (id) => ({ u1: "Rober", u2: "Diego" })[id],
    );
    expect(rows[0]).toMatchObject({ before: "Rober", after: "Diego" });
  });
  it("returns no rows for an entry without changes", () => {
    expect(diffRows([])).toEqual([]);
  });
});

describe("clientLabel", () => {
  it("names each platform in Spanish with its version", () => {
    expect(clientLabel({ platform: "web", appVersion: "1.2.0" })).toBe("Web · v1.2.0");
    expect(clientLabel({ platform: "desktop", appVersion: "1.2.0" })).toBe(
      "Escritorio · v1.2.0",
    );
    expect(clientLabel({ platform: "mobile", appVersion: "0.1.0" })).toBe(
      "Móvil · v0.1.0",
    );
  });
  it("tolerates an unknown platform and a missing version", () => {
    expect(clientLabel({ platform: "tv" as never, appVersion: "" })).toBe("tv");
  });
});
