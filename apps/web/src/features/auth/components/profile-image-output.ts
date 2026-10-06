import type { ProfileImageKind } from "./profile-image-catalog";

/** Legacy cap (characters of the data URL) the mock keeps: it lives in localStorage. */
export const MAX_IMAGE_DATA_URL_LENGTH = 400_000;

/** Encoder qualities the mock tries in order until the result fits the limit. */
export const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.3] as const;

/**
 * Largest source image (width x height) the picker opens. A 48 MP phone photo
 * (8000x6000) passes; anything above ~64 MP is rejected before drawing so a
 * mobile browser is not frozen decoding it.
 */
export const MAX_SOURCE_PIXELS = 64_000_000;

type Size = { width: number; height: number };

export interface ImageOutputProfile {
  /** Banner keeps the picker 5:1 crop aspect; wallpaper keeps the 9:16 portrait crop. */
  sizes: Record<ProfileImageKind, Size>;
  /** Per-kind cap in characters of the data URL. */
  maxDataUrlLength: Record<ProfileImageKind, number>;
  /** Encoder qualities tried in order; the last one is the quality floor. */
  qualitySteps: readonly number[];
}

/** Characters of a base64 data URL holding `bytes` bytes (header margin included). */
function dataUrlLengthForBytes(bytes: number): number {
  return Math.floor(bytes / 3) * 4 + 32;
}

/** Same sizes and caps as before: small, so localStorage keeps working. */
export const MOCK_OUTPUT_PROFILE: ImageOutputProfile = {
  sizes: {
    photo: { width: 256, height: 256 },
    banner: { width: 1200, height: 240 },
    wallpaper: { width: 540, height: 960 },
  },
  maxDataUrlLength: {
    photo: MAX_IMAGE_DATA_URL_LENGTH,
    banner: MAX_IMAGE_DATA_URL_LENGTH,
    wallpaper: MAX_IMAGE_DATA_URL_LENGTH,
  },
  qualitySteps: QUALITY_STEPS,
};

/**
 * Buckets allow 2 MiB (avatars, banners) and 1 MiB (chat-wallpapers); the binary
 * targets leave margin below those limits.
 */
const PROFILE_BINARY_BYTES = 1_600_000;
const WALLPAPER_BINARY_BYTES = 900_000;

export const SUPABASE_OUTPUT_PROFILE: ImageOutputProfile = {
  sizes: {
    photo: { width: 768, height: 768 },
    banner: { width: 2400, height: 480 },
    wallpaper: { width: 1080, height: 1920 },
  },
  maxDataUrlLength: {
    photo: dataUrlLengthForBytes(PROFILE_BINARY_BYTES),
    banner: dataUrlLengthForBytes(PROFILE_BINARY_BYTES),
    wallpaper: dataUrlLengthForBytes(WALLPAPER_BINARY_BYTES),
  },
  qualitySteps: [0.92, 0.85, 0.75, 0.68, 0.6],
};

export function outputProfile(supabase: boolean): ImageOutputProfile {
  return supabase ? SUPABASE_OUTPUT_PROFILE : MOCK_OUTPUT_PROFILE;
}

export function outputSize(
  kind: ProfileImageKind,
  profile: ImageOutputProfile = MOCK_OUTPUT_PROFILE,
): Size {
  return profile.sizes[kind];
}

/** Scales the target down to the crop size so a small source is never upscaled. */
export function fitOutputSize(
  target: Size,
  cropWidth: number,
  cropHeight: number,
): Size {
  const scale = Math.min(
    1,
    cropWidth / target.width,
    cropHeight / target.height,
  );
  return {
    width: Math.max(1, Math.round(target.width * scale)),
    height: Math.max(1, Math.round(target.height * scale)),
  };
}

export function exceedsPixelLimit(width: number, height: number): boolean {
  return width * height > MAX_SOURCE_PIXELS;
}

export function fitsDataUrlLimit(
  dataUrl: string,
  limit: number = MAX_IMAGE_DATA_URL_LENGTH,
): boolean {
  return dataUrl.length <= limit;
}

/**
 * Encodes with WebP (JPEG when the browser ignores WebP) and lowers the quality
 * until the data URL fits the kind's cap. Returns null when no step fits, so the
 * caller reports "too large" instead of saving a poor image.
 */
export function encodeWithinLimit(
  encode: (type: "image/webp" | "image/jpeg", quality: number) => string,
  profile: ImageOutputProfile = MOCK_OUTPUT_PROFILE,
  kind: ProfileImageKind = "photo",
): string | null {
  const limit = profile.maxDataUrlLength[kind];
  for (const quality of profile.qualitySteps) {
    let result = encode("image/webp", quality);
    if (!result.startsWith("data:image/webp"))
      result = encode("image/jpeg", quality);
    if (fitsDataUrlLimit(result, limit)) return result;
  }
  return null;
}
