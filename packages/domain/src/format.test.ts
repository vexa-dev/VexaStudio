import { describe, expect, it } from "vitest";
import { formatDateTimeSeconds } from "./format";

describe("formatDateTimeSeconds", () => {
  it("muestra dd/mm/yyyy HH:mm:ss en hora de Lima", () => {
    expect(formatDateTimeSeconds("2026-10-03T14:05:09Z")).toBe(
      "03/10/2026 09:05:09",
    );
  });

  it("cruza el día según Lima (UTC-5)", () => {
    expect(formatDateTimeSeconds(new Date("2026-10-04T03:59:59Z"))).toBe(
      "03/10/2026 22:59:59",
    );
    expect(formatDateTimeSeconds("2026-10-04T05:00:00Z")).toBe(
      "04/10/2026 00:00:00",
    );
  });
});
