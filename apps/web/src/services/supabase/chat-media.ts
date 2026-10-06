import type { ChatAttachment } from "@vexa/domain/chat";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap } from "./errors";

export const CHAT_SIGN_TTL_SECONDS = 3600;
// Short reuse prevents an intervening query from postponing renewal past expiry.
export const CHAT_SIGN_CACHE_MS = 5 * 60_000;

/** Objects are immutable (unique paths, never upserted), so browsers may keep them for a year. */
export const STORAGE_CACHE_CONTROL = "31536000";

export const CHAT_ATTACHMENT_LIMIT = 25 * 1024 * 1024;
export const CHAT_WALLPAPER_LIMIT = 1024 * 1024;
export function safeFilename(name: string): string {
  return (
    name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 180) || "file"
  );
}
export function decodeAttachment(
  input: ChatAttachment,
  limit = CHAT_ATTACHMENT_LIMIT,
): Blob {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    input.data,
  );
  if (
    !match ||
    match[1] !== input.type ||
    !input.name.trim() ||
    input.name.length > 255
  )
    throw new Error("El archivo adjunto no es válido.");
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    throw new Error("El archivo adjunto no es válido.");
  }
  if (!binary.length || binary.length > limit)
    throw new Error("El archivo está vacío o pesa demasiado.");
  return new Blob([Uint8Array.from(binary, (char) => char.charCodeAt(0))], {
    type: input.type,
  });
}
export async function removeChatObject(
  client: VexaSupabase,
  bucket: string,
  path: string | null,
) {
  if (!path) return;
  try {
    await client.storage.from(bucket).remove([path]);
  } catch {
    /* Best effort; RLS may deny another author's object. */
  }
}

// ---------------------------------------------------------------------------
// Signed URLs persisted across reloads
// ---------------------------------------------------------------------------

export interface PersistedUrl {
  url: string;
  expiresAt: number;
}

const PERSIST_PREFIX = "vexa:signed-urls:v1";
const PERSIST_MAX_ENTRIES = 400;
const persistKey = (scope: string, user: string) =>
  `${PERSIST_PREFIX}:${scope}:${user}`;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isPersistedUrl(value: unknown): value is PersistedUrl {
  if (typeof value !== "object" || value === null) return false;
  const { url, expiresAt } = value as Partial<PersistedUrl>;
  return (
    typeof url === "string" &&
    /^https?:\/\//.test(url) &&
    typeof expiresAt === "number" &&
    Number.isFinite(expiresAt)
  );
}

/**
 * Keeps only `path -> { url, expiresAt }` in localStorage, keyed by scope and user id, so a
 * reload reuses the same signed URL (same token, so the browser HTTP cache hits) while it is
 * still valid. Every call tolerates unavailable or full storage and degrades to "no cache".
 */
export const persistedUrls = {
  read(scope: string, user: string, now: number): Record<string, PersistedUrl> {
    const out: Record<string, PersistedUrl> = {};
    try {
      const raw = browserStorage()?.getItem(persistKey(scope, user));
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (typeof parsed !== "object" || parsed === null) return out;
      for (const [key, value] of Object.entries(parsed))
        if (isPersistedUrl(value) && value.expiresAt > now)
          out[key] = { url: value.url, expiresAt: value.expiresAt };
    } catch {
      /* Corrupt or unavailable storage behaves as an empty cache. */
    }
    return out;
  },
  write(
    scope: string,
    user: string,
    entries: Record<string, PersistedUrl>,
    now: number,
    removed: string[] = [],
  ) {
    try {
      const storage = browserStorage();
      if (!storage) return;
      const merged = { ...persistedUrls.read(scope, user, now), ...entries };
      for (const key of removed) delete merged[key];
      const kept = Object.entries(merged)
        .sort((a, b) => b[1].expiresAt - a[1].expiresAt)
        .slice(0, PERSIST_MAX_ENTRIES);
      const key = persistKey(scope, user);
      if (kept.length) storage.setItem(key, JSON.stringify(Object.fromEntries(kept)));
      else storage.removeItem(key);
    } catch {
      /* Quota or privacy mode: the in-memory cache still works. */
    }
  },
  /** Drops every user's entries for the scope except `keepUser` (account switch or sign-out). */
  purge(scope: string, keepUser?: string) {
    try {
      const storage = browserStorage();
      if (!storage) return;
      const prefix = `${PERSIST_PREFIX}:${scope}:`;
      const doomed: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix) && key.slice(prefix.length) !== keepUser)
          doomed.push(key);
      }
      for (const key of doomed) storage.removeItem(key);
    } catch {
      /* Best effort. */
    }
  },
};

export function createChatMedia(client: VexaSupabase) {
  const cache = new Map<string, { url: string; expires: number }>();
  let cachedUser: string | undefined;
  // A URL is reusable while it is younger than CHAT_SIGN_CACHE_MS, which keeps the guarantee
  // that the UI always receives at least (TTL - CACHE) of remaining life, also after a reload.
  const reuseWindowMs = CHAT_SIGN_TTL_SECONDS * 1000 - CHAT_SIGN_CACHE_MS;
  return {
    async sign(paths: string[]): Promise<Map<string, string>> {
      const user = (await client.auth.getSession()).data.session?.user.id;
      if (user !== cachedUser) {
        cache.clear();
        cachedUser = user;
        persistedUrls.purge("chat", user);
        if (user)
          for (const [path, hit] of Object.entries(
            persistedUrls.read("chat", user, Date.now()),
          ))
            cache.set(path, {
              url: hit.url,
              expires: hit.expiresAt - reuseWindowMs,
            });
      }
      const missing = [...new Set(paths)].filter(
        (path) => (cache.get(path)?.expires ?? 0) <= Date.now(),
      );
      if (missing.length) {
        const data = unwrap(
          await client.storage
            .from("chat-attachments")
            .createSignedUrls(missing, CHAT_SIGN_TTL_SECONDS),
        );
        const signedAt = Date.now();
        const fresh: Record<string, PersistedUrl> = {};
        for (const item of data)
          if (item.path && item.signedUrl && !item.error) {
            cache.set(item.path, {
              url: item.signedUrl,
              expires: signedAt + CHAT_SIGN_CACHE_MS,
            });
            fresh[item.path] = {
              url: item.signedUrl,
              expiresAt: signedAt + CHAT_SIGN_TTL_SECONDS * 1000,
            };
          }
        if (user) persistedUrls.write("chat", user, fresh, signedAt);
      }
      return new Map(
        paths.flatMap((path) =>
          cache.has(path) ? [[path, cache.get(path)!.url]] : [],
        ),
      );
    },
    async upload(thread: string, message: string, attachment: ChatAttachment) {
      const blob = decodeAttachment(attachment);
      const path = `${thread}/${message}/${safeFilename(attachment.name)}`;
      const result = await client.storage
        .from("chat-attachments")
        .upload(path, blob, {
          contentType: attachment.type,
          upsert: false,
          cacheControl: STORAGE_CACHE_CONTROL,
        });
      if (result.error) throw toServiceError(result.error);
      return {
        attachment_path: path,
        attachment_name: attachment.name,
        attachment_mime: attachment.type,
        attachment_size: blob.size,
      };
    },
  };
}
