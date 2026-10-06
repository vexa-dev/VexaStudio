/** Per-viewer chat wallpaper: pure logic and browser-agnostic image storage. */
import type { ChatWallpaper } from "@vexa/domain/chat";

export type PresetId = "graphite" | "steel" | "lines" | "grid";

/** The image bytes live apart from this value (see `readWallpaperImage`). */
export type { ChatWallpaper };

/** Subset of CSS properties applied inline to the messages area. */
export interface WallpaperStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
}

export interface WallpaperPreset {
  id: PresetId;
  label: string;
  style: WallpaperStyle;
}

const NONE: ChatWallpaper = { kind: "none" };

/** Built only from theme tokens, so each preset adapts to light and dark. */
export const WALLPAPER_PRESETS: readonly WallpaperPreset[] = [
  {
    id: "graphite",
    label: "Grafito",
    style: {
      backgroundColor: "color-mix(in srgb, var(--fg) 7%, var(--surface))",
    },
  },
  {
    id: "steel",
    label: "Bruma de acero",
    style: {
      backgroundColor: "var(--surface)",
      backgroundImage:
        "linear-gradient(160deg, color-mix(in srgb, var(--primary-text) 18%, var(--surface)), var(--surface) 75%)",
    },
  },
  {
    id: "lines",
    label: "Líneas VEXA",
    style: {
      backgroundColor: "var(--surface)",
      backgroundImage:
        "repeating-linear-gradient(135deg, color-mix(in srgb, var(--fg) 8%, transparent) 0 1px, transparent 1px 16px)",
    },
  },
  {
    id: "grid",
    label: "Cuadrícula",
    style: {
      backgroundColor: "var(--surface)",
      backgroundImage:
        "linear-gradient(color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--fg) 8%, transparent) 1px, transparent 1px)",
      backgroundSize: "24px 24px",
    },
  },
];

/** Accepts anything stored before this field existed or edited by hand. */
export function normalizeWallpaper(value: unknown): ChatWallpaper {
  if (!value || typeof value !== "object") return NONE;
  const candidate = value as { kind?: unknown; id?: unknown };
  if (candidate.kind === "image") return { kind: "image" };
  if (
    candidate.kind === "preset" &&
    WALLPAPER_PRESETS.some((preset) => preset.id === candidate.id)
  )
    return { kind: "preset", id: candidate.id as PresetId };
  return NONE;
}

/** Keeps text readable over any picture, in light and dark. */
const SCRIM =
  "linear-gradient(color-mix(in srgb, var(--surface) 78%, transparent), color-mix(in srgb, var(--surface) 78%, transparent))";

const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** Inline style for the messages area; `image` without usable bytes is none. */
export function wallpaperStyle(
  wallpaper: ChatWallpaper,
  imageUrl: string | null,
): WallpaperStyle {
  if (wallpaper.kind === "preset") {
    const preset = WALLPAPER_PRESETS.find((entry) => entry.id === wallpaper.id);
    return preset ? { ...preset.style } : {};
  }
  if (wallpaper.kind === "image" && imageUrl && IMAGE_DATA_URL.test(imageUrl))
    return {
      backgroundImage: `${SCRIM}, url("${imageUrl}")`,
      backgroundSize: "auto, cover",
      backgroundPosition: "center, center",
      backgroundRepeat: "no-repeat, no-repeat",
    };
  return {};
}

/** Same cap the profile media uses per image (characters of the data URL). */
export const MAX_WALLPAPER_LENGTH = 400_000;

export type WallpaperStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

/** Fallback when storage is blocked or full; keeps the image for this tab. */
const memory = new Map<string, string>();

export function wallpaperImageKey(userId: string): string {
  return `vexa.chat-wallpaper.v1.${userId}`;
}

function defaultStorage(): WallpaperStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function readWallpaperImage(
  userId: string,
  storage: WallpaperStorage | null = defaultStorage(),
): string | null {
  const key = wallpaperImageKey(userId);
  try {
    const stored = storage?.getItem(key);
    if (stored) return stored;
  } catch {
    /* Sin almacenamiento: se usa la copia en memoria. */
  }
  return memory.get(key) ?? null;
}

/** Returns false when the value is not an image or exceeds the size guard. */
export function writeWallpaperImage(
  userId: string,
  dataUrl: string,
  storage: WallpaperStorage | null = defaultStorage(),
): boolean {
  if (dataUrl.length > MAX_WALLPAPER_LENGTH || !IMAGE_DATA_URL.test(dataUrl))
    return false;
  const key = wallpaperImageKey(userId);
  try {
    if (!storage) throw new Error("no storage");
    storage.setItem(key, dataUrl);
    memory.delete(key);
  } catch {
    memory.set(key, dataUrl);
  }
  return true;
}

export function clearWallpaperImage(
  userId: string,
  storage: WallpaperStorage | null = defaultStorage(),
): void {
  const key = wallpaperImageKey(userId);
  memory.delete(key);
  try {
    storage?.removeItem(key);
  } catch {
    /* Sin almacenamiento: ya se limpió la copia en memoria. */
  }
}
