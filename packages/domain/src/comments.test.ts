import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  MAX_MENTIONS,
  applyMention,
  memberHandle,
  mentionQuery,
  normalizeCommentText,
  resolveMentions,
  sortAnnouncements,
  suggestMentions,
  validateAnnouncementText,
  validateCommentText,
} from "./comments";
import type { Announcement } from "./types";

const members = [
  { id: "u1", name: "Jhony Rivera", username: "jhony" },
  { id: "u2", name: "Rober Vasquez", username: null },
  { id: "u3", name: "José Gónzales", username: undefined },
  { id: "u4", name: "Diego Choque", username: "dchoque" },
];

describe("memberHandle", () => {
  it("usa el usuario en minúsculas y, sin él, el primer nombre sin tildes", () => {
    expect(memberHandle(members[0])).toBe("jhony");
    expect(memberHandle(members[1])).toBe("rober");
    expect(memberHandle(members[2])).toBe("jose");
    expect(memberHandle({ id: "x", name: "  ", username: null })).toBe("");
  });
});

describe("resolveMentions", () => {
  it("resuelve @usuario sin distinguir mayúsculas y sin duplicados", () => {
    expect(resolveMentions("Hola @Rober y @rober, ¿@dchoque?", members)).toEqual(["u2", "u4"]);
  });
  it("ignora al autor, a quien no existe y correos", () => {
    expect(resolveMentions("@jhony @nadie a@jose.com", members, "u1")).toEqual([]);
  });
  it("reconoce el token pegado a puntuación y no corta el punto interno", () => {
    expect(resolveMentions("(@jose), listo.", members)).toEqual(["u3"]);
  });
  it("limita a MAX_MENTIONS", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: `m${i}`, name: `P${i}x`, username: `user${i}` }));
    const text = many.map((m) => `@${m.username}`).join(" ");
    expect(resolveMentions(text, many)).toHaveLength(MAX_MENTIONS);
  });
  it("si dos personas comparten el primer nombre, solo resuelve por usuario", () => {
    const twins = [
      { id: "a", name: "Ana Paz", username: null },
      { id: "b", name: "Ana Ruiz", username: "anar" },
    ];
    expect(resolveMentions("@ana", twins)).toEqual(["a"]);
    const dup = [
      { id: "a", name: "Ana Paz", username: null },
      { id: "b", name: "Ana Ruiz", username: null },
    ];
    expect(resolveMentions("@ana", dup)).toEqual([]);
  });
});

describe("texto del comentario", () => {
  it("recorta y valida longitud", () => {
    expect(normalizeCommentText("  hola  ")).toBe("hola");
    expect(validateCommentText("   ")).toMatch(/vacío/i);
    expect(validateCommentText("x".repeat(COMMENT_MAX_LENGTH + 1))).toMatch(String(COMMENT_MAX_LENGTH));
    expect(validateCommentText("x".repeat(COMMENT_MAX_LENGTH))).toBeNull();
  });
  it("valida el anuncio con su propio límite", () => {
    expect(validateAnnouncementText("")).toMatch(/vacío/i);
    expect(validateAnnouncementText("x".repeat(ANNOUNCEMENT_MAX_LENGTH + 1))).toMatch(String(ANNOUNCEMENT_MAX_LENGTH));
    expect(validateAnnouncementText("Hola")).toBeNull();
  });
});

describe("sugerencias de @mención", () => {
  it("detecta el token bajo el cursor", () => {
    expect(mentionQuery("Hola @ro", 8)).toEqual({ start: 5, query: "ro" });
    expect(mentionQuery("Hola @", 6)).toEqual({ start: 5, query: "" });
    expect(mentionQuery("Hola ro", 7)).toBeNull();
    expect(mentionQuery("mail a@ro", 9)).toBeNull();
    expect(mentionQuery("Hola @ro y más", 14)).toBeNull();
  });
  it("filtra por usuario o nombre y excluye al autor", () => {
    expect(suggestMentions("ch", members).map((m) => m.id)).toEqual(["u4"]);
    expect(suggestMentions("", members, "u1").map((m) => m.id)).toEqual(["u2", "u3", "u4"]);
    expect(suggestMentions("r", members).map((m) => m.id)).toEqual(["u2", "u1"]);
  });
  it("inserta el usuario elegido y deja un espacio", () => {
    expect(applyMention("Hola @ro y más", { start: 5, query: "ro" }, "rober")).toEqual({
      text: "Hola @rober y más",
      caret: 12,
    });
  });
});

describe("sortAnnouncements", () => {
  const a = (id: string, pinned: boolean, createdAt: string): Announcement => ({
    id,
    authorId: "u1",
    text: id,
    pinned,
    createdAt,
  });
  it("fijados primero y luego lo más nuevo", () => {
    const sorted = sortAnnouncements([
      a("old", false, "2026-10-01T00:00:00.000Z"),
      a("pin-old", true, "2026-09-01T00:00:00.000Z"),
      a("new", false, "2026-10-05T00:00:00.000Z"),
      a("pin-new", true, "2026-09-20T00:00:00.000Z"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["pin-new", "pin-old", "new", "old"]);
  });
});
