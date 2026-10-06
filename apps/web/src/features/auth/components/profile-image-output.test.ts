import { describe, expect, it } from "vitest";
import {
  MAX_IMAGE_DATA_URL_LENGTH,
  MAX_SOURCE_PIXELS,
  MOCK_OUTPUT_PROFILE,
  QUALITY_STEPS,
  SUPABASE_OUTPUT_PROFILE,
  encodeWithinLimit,
  exceedsPixelLimit,
  fitOutputSize,
  fitsDataUrlLimit,
  outputProfile,
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

describe("outputProfile", () => {
  it("picks the profile by data source", () => {
    expect(outputProfile(false)).toBe(MOCK_OUTPUT_PROFILE);
    expect(outputProfile(true)).toBe(SUPABASE_OUTPUT_PROFILE);
  });

  it("keeps the mock profile identical to the legacy values", () => {
    expect(MOCK_OUTPUT_PROFILE.qualitySteps).toEqual(QUALITY_STEPS);
    expect(MOCK_OUTPUT_PROFILE.maxDataUrlLength).toEqual({
      photo: 400_000,
      banner: 400_000,
      wallpaper: 400_000,
    });
  });
});

describe("Supabase output profile", () => {
  const { sizes, maxDataUrlLength, qualitySteps } = SUPABASE_OUTPUT_PROFILE;

  it("uses high-resolution sizes that keep the picker aspect", () => {
    expect(outputSize("photo", SUPABASE_OUTPUT_PROFILE)).toEqual({
      width: 768,
      height: 768,
    });
    expect(sizes.banner).toEqual({ width: 2400, height: 480 });
    expect(sizes.wallpaper).toEqual({ width: 1080, height: 1920 });
  });

  it("derives the caps from the bucket limits with base64 overhead", () => {
    const binary = (length: number) => Math.floor(((length - 32) / 4) * 3);
    expect(binary(maxDataUrlLength.photo)).toBeLessThanOrEqual(1_600_000);
    expect(binary(maxDataUrlLength.photo)).toBeGreaterThan(1_599_000);
    expect(maxDataUrlLength.banner).toBe(maxDataUrlLength.photo);
    expect(binary(maxDataUrlLength.wallpaper)).toBeLessThanOrEqual(900_000);
    // The 2 MiB / 1 MiB bucket limits always leave headroom.
    expect(binary(maxDataUrlLength.photo)).toBeLessThan(2 * 1024 * 1024);
    expect(binary(maxDataUrlLength.wallpaper)).toBeLessThan(1024 * 1024);
  });

  it("starts at 0.92 and never goes below 0.6", () => {
    expect(qualitySteps[0]).toBe(0.92);
    expect(Math.min(...qualitySteps)).toBe(0.6);
    expect([...qualitySteps]).toEqual([...qualitySteps].sort((a, b) => b - a));
  });

  it("accepts a large result with the Supabase cap and rejects it for the mock", () => {
    const large = `data:image/webp;base64,${"A".repeat(1_000_000)}`;
    expect(fitsDataUrlLimit(large, 1_000_100)).toBe(true);
    expect(fitsDataUrlLimit(large)).toBe(false);
  });

  it("returns null instead of dropping below the quality floor", () => {
    const qualities: number[] = [];
    const result = encodeWithinLimit(
      (type, quality) => {
        qualities.push(quality);
        return `data:${type};base64,${"A".repeat(3_000_000)}`;
      },
      SUPABASE_OUTPUT_PROFILE,
      "photo",
    );
    expect(result).toBeNull();
    expect(Math.min(...qualities)).toBe(0.6);
  });

  it("encodes at 0.92 when the first attempt fits the kind cap", () => {
    const calls: number[] = [];
    const result = encodeWithinLimit(
      (type, quality) => {
        calls.push(quality);
        return small(type);
      },
      SUPABASE_OUTPUT_PROFILE,
      "wallpaper",
    );
    expect(result).toBe(small("image/webp"));
    expect(calls).toEqual([0.92]);
  });
});

describe("fitOutputSize", () => {
  const target = { width: 2400, height: 480 };

  it("never upscales a crop smaller than the target", () => {
    expect(fitOutputSize(target, 1200, 240)).toEqual({
      width: 1200,
      height: 240,
    });
  });

  it("uses the target when the crop is larger", () => {
    expect(fitOutputSize(target, 4000, 800)).toEqual(target);
  });

  it("keeps at least one pixel", () => {
    expect(fitOutputSize(target, 0, 0)).toEqual({ width: 1, height: 1 });
  });
});

describe("exceedsPixelLimit", () => {
  it("allows a 48 MP phone photo and blocks absurd dimensions", () => {
    expect(MAX_SOURCE_PIXELS).toBe(64_000_000);
    expect(exceedsPixelLimit(8000, 6000)).toBe(false);
    expect(exceedsPixelLimit(12000, 8000)).toBe(true);
  });
});
