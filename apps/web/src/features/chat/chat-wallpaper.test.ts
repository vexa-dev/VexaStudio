import { describe, expect, it } from "vitest";
import {
  WALLPAPER_PRESETS,
  clearWallpaperImage,
  normalizeWallpaper,
  readWallpaperImage,
  wallpaperImageKey,
  wallpaperStyle,
  writeWallpaperImage,
  type WallpaperStorage,
} from "./chat-wallpaper";

const IMAGE = "data:image/webp;base64,AAAA";

function fakeStorage(options: { throws?: boolean } = {}): WallpaperStorage & {
  data: Map<string, string>;
} {
  const data = new Map<string, string>();
  const guard = () => {
    if (options.throws) throw new Error("blocked");
  };
  return {
    data,
    getItem: (key) => {
      guard();
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      guard();
      data.set(key, value);
    },
    removeItem: (key) => {
      guard();
      data.delete(key);
    },
  };
}

describe("WALLPAPER_PRESETS", () => {
  it("offers four presets with Spanish labels and token-only CSS", () => {
    expect(WALLPAPER_PRESETS).toHaveLength(4);
    for (const preset of WALLPAPER_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(2);
      expect(
        preset.style.backgroundImage ?? preset.style.backgroundColor,
      ).toBeTruthy();
      const css = JSON.stringify(preset.style);
      expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(css).not.toContain("url(");
      expect(css).toContain("var(--");
    }
  });
});

describe("normalizeWallpaper", () => {
  it("falls back to none for missing or invalid values", () => {
    for (const value of [undefined, null, 4, "x", [], {}, { kind: "gif" }])
      expect(normalizeWallpaper(value)).toEqual({ kind: "none" });
  });
  it("keeps a known preset and drops an unknown one", () => {
    expect(normalizeWallpaper({ kind: "preset", id: "grid" })).toEqual({
      kind: "preset",
      id: "grid",
    });
    expect(normalizeWallpaper({ kind: "preset", id: "nope" })).toEqual({
      kind: "none",
    });
    expect(normalizeWallpaper({ kind: "preset" })).toEqual({ kind: "none" });
  });
  it("keeps image and strips any extra payload", () => {
    expect(normalizeWallpaper({ kind: "image", data: "x" })).toEqual({
      kind: "image",
    });
  });
});

describe("wallpaperStyle", () => {
  it("returns an empty style for none", () => {
    expect(wallpaperStyle({ kind: "none" }, null)).toEqual({});
  });
  it("returns the preset style", () => {
    const preset = WALLPAPER_PRESETS[0];
    expect(wallpaperStyle({ kind: "preset", id: preset.id }, null)).toEqual(
      preset.style,
    );
  });
  it("covers the area with a scrim over the image", () => {
    const style = wallpaperStyle({ kind: "image" }, IMAGE);
    expect(style.backgroundImage).toContain(`url("${IMAGE}")`);
    expect(style.backgroundImage).toContain("var(--surface)");
    expect(style.backgroundSize).toContain("cover");
  });
  it("falls back to none without usable bytes", () => {
    expect(wallpaperStyle({ kind: "image" }, null)).toEqual({});
    expect(wallpaperStyle({ kind: "image" }, 'javascript:alert("x")')).toEqual(
      {},
    );
    expect(
      wallpaperStyle({ kind: "image" }, 'data:image/webp;base64,A")'),
    ).toEqual({});
  });
});

describe("wallpaper image storage", () => {
  it("uses a per-user key", () => {
    expect(wallpaperImageKey("a")).toBe("vexa.chat-wallpaper.v1.a");
  });
  it("writes, reads per user and clears", () => {
    const storage = fakeStorage();
    expect(writeWallpaperImage("a", IMAGE, storage)).toBe(true);
    expect(readWallpaperImage("a", storage)).toBe(IMAGE);
    expect(readWallpaperImage("b", storage)).toBeNull();
    clearWallpaperImage("a", storage);
    expect(readWallpaperImage("a", storage)).toBeNull();
  });
  it("rejects non-images and images over the limit", () => {
    const storage = fakeStorage();
    expect(writeWallpaperImage("a", "hello", storage)).toBe(false);
    const big = `data:image/webp;base64,${"A".repeat(400_000)}`;
    expect(writeWallpaperImage("a", big, storage)).toBe(false);
    expect(readWallpaperImage("a", storage)).toBeNull();
  });
  it("keeps working in memory when storage throws", () => {
    const storage = fakeStorage({ throws: true });
    expect(writeWallpaperImage("mem", IMAGE, storage)).toBe(true);
    expect(readWallpaperImage("mem", storage)).toBe(IMAGE);
    clearWallpaperImage("mem", storage);
    expect(readWallpaperImage("mem", storage)).toBeNull();
  });
});
