import { describe, expect, it } from "vitest";
import { segmentLayout } from "./segmented-bar-model";

describe("segmentLayout", () => {
  it("marks all-zero values as empty with equal weights", () => {
    expect(segmentLayout([0, 0, 0, 0])).toEqual({
      empty: true,
      weights: [1, 1, 1, 1],
    });
  });

  it("returns an empty layout for an empty array", () => {
    expect(segmentLayout([])).toEqual({ empty: true, weights: [] });
  });

  it("keeps proportional weights when one value dominates", () => {
    const { empty, weights } = segmentLayout([80, 20, 0]);
    expect(empty).toBe(false);
    expect(weights[0]).toBe(80);
    expect(weights[1]).toBe(20);
    expect(weights[2]).toBeCloseTo(2); // floored to 2% of 100
  });

  it("floors tiny values to 2% of the total", () => {
    const { weights } = segmentLayout([1000, 1]);
    expect(weights[0]).toBe(1000);
    expect(weights[1]).toBeCloseTo(1001 * 0.02);
  });

  it("treats negative and non-finite values as 0", () => {
    expect(segmentLayout([-5, Number.NaN, Infinity])).toEqual({
      empty: true,
      weights: [1, 1, 1],
    });
    const { empty, weights } = segmentLayout([10, -3, Number.NaN]);
    expect(empty).toBe(false);
    expect(weights[0]).toBe(10);
    expect(weights[1]).toBeCloseTo(0.2);
    expect(weights[2]).toBeCloseTo(0.2);
  });
});
