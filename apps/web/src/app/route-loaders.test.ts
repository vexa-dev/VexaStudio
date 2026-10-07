import { describe, expect, it } from "vitest";
import { prefetchRoute } from "./route-loaders";

describe("prefetchRoute", () => {
  it("ignores unknown paths without throwing", () => {
    expect(() => prefetchRoute("/no-existe")).not.toThrow();
  });
});
