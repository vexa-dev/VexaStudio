import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./chat-store";
import { collectSharedMedia, groupByMonth } from "./shared-media";

const at = (iso: string) => Date.parse(iso);

function message(
  id: string,
  sentAt: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id,
    authorId: "u1",
    text: "",
    sentAt: at(sentAt),
    reactions: {},
    ...extra,
  };
}

const attach = (name: string, type: string, data = "data:;base64,QUJD") => ({
  name,
  type,
  data,
});

describe("collectSharedMedia", () => {
  it("returns empty lists for no messages", () => {
    expect(collectSharedMedia([])).toEqual({
      media: [],
      documents: [],
      links: [],
    });
  });

  it("splits media from documents and sorts newest first", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", {
        attachment: attach("a.png", "image/png"),
      }),
      message("b", "2026-10-03T10:00:00Z", {
        attachment: attach("b.pdf", "application/pdf"),
      }),
      message("c", "2026-10-02T10:00:00Z", {
        attachment: attach("c.mp4", "video/mp4"),
      }),
      message("d", "2026-10-04T10:00:00Z", {
        attachment: attach("d.zip", "application/zip"),
      }),
      message("e", "2026-10-05T10:00:00Z", {
        attachment: attach("e.bin", "application/octet-stream"),
      }),
    ]);
    expect(result.media.map((item) => item.messageId)).toEqual(["c", "a"]);
    expect(result.documents.map((item) => item.messageId)).toEqual([
      "e",
      "d",
      "b",
    ]);
    expect(result.media[0].kind).toBe("video");
    expect(result.documents[2].kind).toBe("document");
    expect(result.media[1].bytes).toBe(3);
  });

  it("sends SVG to documents", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", {
        attachment: attach("logo.svg", "image/svg+xml"),
      }),
    ]);
    expect(result.media).toEqual([]);
    expect(result.documents[0].kind).toBe("design");
  });

  it("skips deleted messages", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", {
        deleted: true,
        text: "https://example.com",
        attachment: attach("a.png", "image/png"),
      }),
    ]);
    expect(result).toEqual({ media: [], documents: [], links: [] });
  });

  it("extracts links, trimming trailing punctuation", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", {
        text: "Mira https://www.vexa.pe/docs, y también (http://example.com/a?b=1).",
      }),
    ]);
    expect(result.links.map((link) => link.url)).toEqual([
      "https://www.vexa.pe/docs",
      "http://example.com/a?b=1",
    ]);
    expect(result.links.map((link) => link.host)).toEqual([
      "vexa.pe",
      "example.com",
    ]);
  });

  it("de-duplicates a URL repeated in the same message only", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", {
        text: "https://a.com https://a.com",
      }),
      message("b", "2026-10-02T10:00:00Z", { text: "https://a.com" }),
    ]);
    expect(result.links.map((link) => link.messageId)).toEqual(["b", "a"]);
  });

  it("ignores invalid URLs", () => {
    const result = collectSharedMedia([
      message("a", "2026-10-01T10:00:00Z", { text: "http://" }),
    ]);
    expect(result.links).toEqual([]);
  });
});

describe("groupByMonth", () => {
  it("returns no groups for empty input", () => {
    expect(groupByMonth([])).toEqual([]);
  });

  it("groups by Lima month, newest first, keeping item order", () => {
    const items = [
      { sentAt: at("2026-11-02T10:00:00Z"), id: 1 },
      // 03:00Z on Nov 1 is still Oct 31 in Lima.
      { sentAt: at("2026-11-01T03:00:00Z"), id: 2 },
      { sentAt: at("2026-10-10T10:00:00Z"), id: 3 },
      { sentAt: at("2026-09-30T10:00:00Z"), id: 4 },
    ];
    const groups = groupByMonth(items);
    expect(groups.map((group) => group.key)).toEqual([
      "2026-11",
      "2026-10",
      "2026-09",
    ]);
    expect(groups[1].label).toBe("Octubre 2026");
    expect(groups[1].items.map((item) => item.id)).toEqual([2, 3]);
  });
});
