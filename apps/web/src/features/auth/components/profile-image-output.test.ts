import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  QUALITY_STEPS,
  encodeWithinLimit,
  fitsDataUrlLimit,
  outputSize,
} from "./profile-image-output";

const small = (type: string) => `data:${type};base64,AAAA`;
const big = (type: string) =>
  `data:${type};base64,${"A".repeat(MAX_IMAGE_DATA_URL_LENGTH)}`;

describe("outputSize", () => {
  it("caps the avatar at 256x256 and the banner at 1200x240", () => {
    expect(outputSize("photo")).toEqual({ width: 256, height: 256 });
    expect(outputSize("banner")).toEqual({ width: 1200, height: 240 });
  });

  it("caps the chat wallpaper at 540x960 (9:16 portrait)", () => {
    expect(outputSize("wallpaper")).toEqual({ width: 540, height: 960 });
  });
});

describe("fitsDataUrlLimit", () => {
  it("accepts a data URL at the limit and rejects one above it", () => {
    expect("x".repeat(MAX_IMAGE_DATA_URL_LENGTH)).toHaveLength(
      MAX_IMAGE_DATA_URL_LENGTH,
    );
    expect(fitsDataUrlLimit("x".repeat(MAX_IMAGE_DATA_URL_LENGTH))).toBe(true);
    expect(fitsDataUrlLimit("x".repeat(MAX_IMAGE_DATA_URL_LENGTH + 1))).toBe(
      false,
    );
  });
});

describe("encodeWithinLimit", () => {
  it("uses webp at the first quality when it fits", () => {
    const calls: Array<[string, number]> = [];
    const result = encodeWithinLimit((type, quality) => {
      calls.push([type, quality]);
      return small(type);
    });
    expect(result).toBe(small("image/webp"));
    expect(calls).toEqual([["image/webp", QUALITY_STEPS[0]]]);
  });

  it("lowers the quality step by step until the result fits", () => {
    const calls: number[] = [];
    const result = encodeWithinLimit((type, quality) => {
      calls.push(quality);
      return calls.length < 3 ? big(type) : small(type);
    });
    expect(result).toBe(small("image/webp"));
    expect(calls).toEqual([
      QUALITY_STEPS[0],
      QUALITY_STEPS[1],
      QUALITY_STEPS[2],
    ]);
  });

  it("falls back to jpeg when the browser does not return webp", () => {
    const types: string[] = [];
    const result = encodeWithinLimit((type) => {
      types.push(type);
      return type === "image/jpeg" ? small(type) : small("image/png");
    });
    expect(result).toBe(small("image/jpeg"));
    expect(types).toEqual(["image/webp", "image/jpeg"]);
  });

  it("returns null when no quality step fits", () => {
    expect(encodeWithinLimit((type) => big(type))).toBeNull();
  });
});
