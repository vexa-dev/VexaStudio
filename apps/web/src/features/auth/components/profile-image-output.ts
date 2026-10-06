import type { ProfileImageKind } from "./profile-image-catalog";

/** Same cap the profile service enforces per image (characters of the data URL). */
export const MAX_IMAGE_DATA_URL_LENGTH = 400_000;

/** Encoder qualities tried in order until the result fits the limit. */
export const QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.3] as const;

/**
 * Banner keeps the picker 5:1 crop aspect (fits within 1200x400); the chat
 * wallpaper keeps the 9:16 portrait crop.
 */
const OUTPUT_SIZES = {
  photo: { width: 256, height: 256 },
  banner: { width: 1200, height: 240 },
  wallpaper: { width: 540, height: 960 },
} as const satisfies Record<
  ProfileImageKind,
  { width: number; height: number }
>;

export function outputSize(kind: ProfileImageKind) {
  return OUTPUT_SIZES[kind];
}

export function fitsDataUrlLimit(dataUrl: string): boolean {
  return dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH;
}

/**
 * Encodes with WebP (JPEG when the browser ignores WebP) and lowers the quality
 * until the data URL fits the limit. Returns null when no step fits.
 */
export function encodeWithinLimit(
  encode: (type: "image/webp" | "image/jpeg", quality: number) => string,
): string | null {
  for (const quality of QUALITY_STEPS) {
    let result = encode("image/webp", quality);
    if (!result.startsWith("data:image/webp"))
      result = encode("image/jpeg", quality);
    if (fitsDataUrlLimit(result)) return result;
  }
  return null;
}
