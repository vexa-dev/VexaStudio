import { describe, expect, it } from "vitest";
import { initials } from "./utils";

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Diego Choque")).toBe("DC");
    expect(initials("José Gónzales Pérez")).toBe("JG");
  });

  it("ignores separators that are not words", () => {
    expect(initials("Alex · Colaborador demo")).toBe("AC");
    expect(initials("Ana - Lima")).toBe("AL");
  });

  it("handles a single word and empty text", () => {
    expect(initials("Vexa")).toBe("V");
    expect(initials("   ")).toBe("");
  });
});
