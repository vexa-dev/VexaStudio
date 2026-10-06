import { describe, expect, it } from "vitest";
import { splitEmoji, toTextPresentation } from "./emoji-text";

describe("toTextPresentation", () => {
  it("drops the emoji variation selector so the monochrome font is used", () => {
    expect(toTextPresentation("✌️")).toBe("✌");
    expect(toTextPresentation("❤️")).toBe("❤");
  });

  it("leaves emoji without a selector and plain text untouched", () => {
    expect(toTextPresentation("\u{1F44D}")).toBe("\u{1F44D}");
    expect(toTextPresentation("hola")).toBe("hola");
  });

  it("keeps the keycap and ZWJ joiners intact", () => {
    expect(toTextPresentation("1️⃣")).toBe("1⃣");
    expect(toTextPresentation("\u{1F9D1}‍\u{1F4BB}")).toBe(
      "\u{1F9D1}‍\u{1F4BB}",
    );
  });
});

describe("splitEmoji", () => {
  it("returns no segments for an empty string", () => {
    expect(splitEmoji("")).toEqual([]);
  });

  it("keeps plain text as one segment", () => {
    expect(splitEmoji("Hola equipo")).toEqual([
      { text: "Hola equipo", emoji: false },
    ]);
  });

  it("splits text around a single emoji, preserving order", () => {
    expect(splitEmoji("Listo 👍 gracias")).toEqual([
      { text: "Listo ", emoji: false },
      { text: "👍", emoji: true },
      { text: " gracias", emoji: false },
    ]);
  });

  it("keeps a ZWJ sequence together", () => {
    expect(splitEmoji("👩‍💻")).toEqual([{ text: "👩‍💻", emoji: true }]);
  });

  it("keeps the variation selector with its emoji", () => {
    expect(splitEmoji("amor ❤️!")).toEqual([
      { text: "amor ", emoji: false },
      { text: "❤️", emoji: true },
      { text: "!", emoji: false },
    ]);
  });

  it("treats keycaps as emoji but not bare digits", () => {
    expect(splitEmoji("1 y 1️⃣")).toEqual([
      { text: "1 y ", emoji: false },
      { text: "1️⃣", emoji: true },
    ]);
  });

  it("keeps skin-tone modifiers attached", () => {
    expect(splitEmoji("👍🏽")).toEqual([{ text: "👍🏽", emoji: true }]);
  });

  it("separates consecutive emoji", () => {
    expect(splitEmoji("🎉🚀")).toEqual([
      { text: "🎉", emoji: true },
      { text: "🚀", emoji: true },
    ]);
  });
});
