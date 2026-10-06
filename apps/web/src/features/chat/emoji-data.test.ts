import { describe, expect, it } from "vitest";
import { EMOJI_CATEGORIES, pushRecent, searchEmojis } from "./emoji-data";

describe("EMOJI_CATEGORIES", () => {
  it("has the five curated categories with Spanish labels", () => {
    expect(EMOJI_CATEGORIES.map((category) => category.label)).toEqual([
      "Caras",
      "Gestos y personas",
      "Trabajo y objetos",
      "Naturaleza y comida",
      "Símbolos",
    ]);
  });

  it("has no duplicate emoji and a tasteful size per category", () => {
    const all = EMOJI_CATEGORIES.flatMap((category) =>
      category.emojis.map((entry) => entry.char),
    );
    expect(new Set(all).size).toBe(all.length);
    for (const category of EMOJI_CATEGORIES) {
      expect(category.emojis.length).toBeGreaterThanOrEqual(20);
      expect(category.emojis.length).toBeLessThanOrEqual(40);
    }
  });
});

describe("searchEmojis", () => {
  it("returns nothing for a blank query", () => {
    expect(searchEmojis("   ")).toEqual([]);
  });

  it("matches Spanish keywords ignoring case and accents", () => {
    const chars = searchEmojis("CORAZON").map((entry) => entry.char);
    expect(chars).toContain("❤️");
    expect(searchEmojis("corazón").map((entry) => entry.char)).toEqual(chars);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchEmojis("zzzzqq")).toEqual([]);
  });
});

describe("pushRecent", () => {
  it("puts the latest emoji first", () => {
    expect(pushRecent(["a", "b"], "c", 5)).toEqual(["c", "a", "b"]);
  });

  it("moves a repeated emoji to the front without duplicating", () => {
    expect(pushRecent(["a", "b", "c"], "c", 5)).toEqual(["c", "a", "b"]);
  });

  it("caps the list length", () => {
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("does not mutate the input", () => {
    const list = ["a"];
    pushRecent(list, "b", 5);
    expect(list).toEqual(["a"]);
  });
});
