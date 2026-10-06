import { describe, expect, it } from "vitest";
import { z } from "zod";
import { configureZod } from "./zod-config";

describe("configureZod", () => {
  it("turns off zod's JIT so a strict CSP never sees its eval probe", () => {
    configureZod();
    expect(z.config().jitless).toBe(true);
  });

  it("keeps schemas working without JIT", () => {
    configureZod();
    const schema = z.object({ hours: z.number().positive() });
    expect(schema.safeParse({ hours: 1.5 }).success).toBe(true);
    expect(schema.safeParse({ hours: -1 }).success).toBe(false);
  });
});
