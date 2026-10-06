import type { ChatAttachment } from "@vexa/domain/chat";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap } from "./errors";

export const CHAT_SIGN_TTL_SECONDS = 3600;
// Short reuse prevents an intervening query from postponing renewal past expiry.
export const CHAT_SIGN_CACHE_MS = 5 * 60_000;

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
export function createChatMedia(client: VexaSupabase) {
  const cache = new Map<string, { url: string; expires: number }>();
  let cachedUser: string | undefined;
  return {
    async sign(paths: string[]): Promise<Map<string, string>> {
      const user = (await client.auth.getSession()).data.session?.user.id;
      if (user !== cachedUser) {
        cache.clear();
        cachedUser = user;
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
        for (const item of data)
          if (item.path && item.signedUrl && !item.error)
            cache.set(item.path, {
              url: item.signedUrl,
              expires: Date.now() + CHAT_SIGN_CACHE_MS,
            });
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
        .upload(path, blob, { contentType: attachment.type, upsert: false });
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
