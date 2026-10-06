export interface TextSegment {
  text: string;
  emoji: boolean;
}

const PICTO = String.raw`\p{Extended_Pictographic}`;
const MODIFIER = String.raw`(?:️|\p{Emoji_Modifier})?`;
// One emoji: a keycap, or a pictograph with optional selector/skin tone and
// any number of ZWJ-joined pictographs.
const EMOJI = new RegExp(
  String.raw`[0-9#*]️?⃣|${PICTO}${MODIFIER}(?:‍${PICTO}${MODIFIER})*`,
  "gu",
);

/**
 * Display-only: drops U+FE0F so the browser keeps the monochrome Noto Emoji
 * glyph instead of switching to the system colour emoji font. The stored
 * message text is never changed.
 */
export function toTextPresentation(emoji: string): string {
  return emoji.replaceAll("️", "");
}

/** Splits text into ordered plain and emoji segments (one segment per emoji). */
export function splitEmoji(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(EMOJI)) {
    const start = match.index;
    if (start > last)
      segments.push({ text: text.slice(last, start), emoji: false });
    segments.push({ text: match[0], emoji: true });
    last = start + match[0].length;
  }
  if (last < text.length)
    segments.push({ text: text.slice(last), emoji: false });
  return segments;
}
