import type { Announcement, Id } from "./types";

export const COMMENT_MAX_LENGTH = 2000;
export const ANNOUNCEMENT_MAX_LENGTH = 1000;
/** Espeja `comments_mentions_len_check` de SQL. */
export const MAX_MENTIONS = 10;

/** Lo mínimo que se necesita de una persona para mencionarla. */
export interface Mentionable {
  id: Id;
  name: string;
  username?: string | null;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/**
 * Cómo se escribe la mención de una persona: su usuario único o, si aún no lo configuró, su primer
 * nombre sin tildes en minúsculas. La base solo recibe ids: esto es solo para escribir y reconocer.
 */
export function memberHandle(member: Mentionable): string {
  const username = member.username?.trim().toLowerCase();
  if (username) return username;
  const first = fold(member.name.trim().split(/\s+/)[0] ?? "");
  return first.replace(/[^a-z0-9_.]/g, "");
}

const TOKEN = /(^|[^\p{L}\p{N}_.@])@([a-z0-9_.]{1,30})/giu;

/**
 * Personas mencionadas con `@usuario` en el texto, en orden de aparición, sin duplicados, sin el autor y
 * sin pasar de MAX_MENTIONS. Un primer nombre compartido por dos personas sin usuario no se resuelve.
 */
export function resolveMentions(text: string, members: Mentionable[], authorId?: Id): Id[] {
  // Un usuario explícito gana; si varias personas comparten un primer nombre sin usuario, no se resuelve.
  const candidates = new Map<string, Mentionable[]>();
  for (const member of members) {
    const handle = memberHandle(member);
    if (handle) candidates.set(handle, [...(candidates.get(handle) ?? []), member]);
  }
  const byHandle = new Map<string, Id>();
  for (const [handle, list] of candidates) {
    const explicit = list.filter((m) => m.username?.trim());
    const pool = explicit.length > 0 ? explicit : list;
    if (pool.length === 1) byHandle.set(handle, pool[0].id);
  }
  const found: Id[] = [];
  for (const match of text.matchAll(TOKEN)) {
    // El punto final de una frase ("@jose.") no es parte del usuario.
    const handle = match[2].toLowerCase().replace(/\.+$/, "");
    const id = byHandle.get(handle);
    if (!id || id === authorId || found.includes(id)) continue;
    found.push(id);
    if (found.length === MAX_MENTIONS) break;
  }
  return found;
}

export function normalizeCommentText(text: string): string {
  return text.trim();
}

export function validateCommentText(text: string): string | null {
  const value = normalizeCommentText(text);
  if (!value) return "El comentario no puede estar vacío";
  if (value.length > COMMENT_MAX_LENGTH)
    return `El comentario admite hasta ${COMMENT_MAX_LENGTH} caracteres`;
  return null;
}

export function validateAnnouncementText(text: string): string | null {
  const value = text.trim();
  if (!value) return "El anuncio no puede estar vacío";
  if (value.length > ANNOUNCEMENT_MAX_LENGTH)
    return `El anuncio admite hasta ${ANNOUNCEMENT_MAX_LENGTH} caracteres`;
  return null;
}

/** Token `@consulta` que termina justo en el cursor, o null si el cursor no está sobre una mención. */
export function mentionQuery(
  text: string,
  caret: number,
): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|[^\p{L}\p{N}_.@])@([a-z0-9_.]{0,30})$/iu.exec(before);
  if (!match) return null;
  return { start: before.length - match[2].length - 1, query: match[2] };
}

/** Personas que coinciden con lo escrito tras `@`: primero por inicio de usuario, luego por palabra del nombre. */
export function suggestMentions<T extends Mentionable>(
  query: string,
  members: T[],
  excludeId?: Id,
  limit = 6,
): T[] {
  const q = fold(query);
  const ranked: { member: T; rank: number }[] = [];
  for (const member of members) {
    if (member.id === excludeId) continue;
    const handle = memberHandle(member);
    if (!handle) continue;
    let rank: number | null = null;
    if (!q || handle.startsWith(q)) rank = 0;
    else if (fold(member.name).split(/\s+/).some((word) => word.startsWith(q))) rank = 1;
    if (rank !== null) ranked.push({ member, rank });
  }
  return ranked.sort((a, b) => a.rank - b.rank).slice(0, limit).map((r) => r.member);
}

/** Reemplaza el token bajo el cursor por la mención elegida y devuelve el texto y el nuevo cursor. */
export function applyMention(
  text: string,
  token: { start: number; query: string },
  handle: string,
): { text: string; caret: number } {
  const end = token.start + 1 + token.query.length;
  const rest = text.slice(end);
  const spacer = /^\s/.test(rest) ? "" : " ";
  const inserted = `@${handle}${spacer}`;
  return {
    text: `${text.slice(0, token.start)}${inserted}${rest}`,
    // El cursor queda después del espacio que separa la mención del resto.
    caret: token.start + handle.length + 2,
  };
}

/** Anuncios fijados primero y, dentro de cada grupo, los más nuevos. */
export function sortAnnouncements(items: Announcement[]): Announcement[] {
  return [...items].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
  );
}
