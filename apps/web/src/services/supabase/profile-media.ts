import type { Profile } from "@vexa/domain/types";
import type { VexaSupabase } from "@/lib/supabase";
import { toServiceError, unwrap, unwrapMaybe } from "./errors";
import { mapProfile } from "./mappers";
import type { Tables } from "./database.types";

/**
 * Fotos y banners de perfil en Storage (buckets privados `avatars` y `banners`). La base guarda
 * solo la ruta del objeto (`<user_id>/<tipo>-<marca>.<ext>`); la interfaz recibe URLs firmadas de
 * vida corta, resueltas aquí y guardadas en memoria.
 */
export type ProfileImageKind = "avatar" | "banner";
export type ProfileBucket = "avatars" | "banners";

const BUCKET: Record<ProfileImageKind, ProfileBucket> = {
  avatar: "avatars",
  banner: "banners",
};
const COLUMN = { avatar: "avatar_path", banner: "banner_path" } as const;

/** Mismo texto que el mock para cualquier imagen rechazada. */
const INVALID_IMAGE = "La imagen no es válida o pesa demasiado.";
/** Tope del bucket (2 MiB); la API de Storage lo vuelve a aplicar. */
const MAX_BYTES = 2 * 1024 * 1024;
const DATA_URL = /^data:image\/(webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/;
const EXTENSION = { webp: "webp", jpeg: "jpg", png: "png" } as const;

export interface ImageBlob {
  blob: Blob;
  mime: string;
  ext: string;
}

/** Convierte el data URL que entrega el selector en un Blob; solo webp, jpeg y png de hasta 2 MiB. */
export function dataUrlToBlob(dataUrl: string): ImageBlob {
  const match = DATA_URL.exec(dataUrl);
  if (!match) throw new Error(INVALID_IMAGE);
  const type = match[1] as keyof typeof EXTENSION;
  const payload = match[2] ?? "";
  let binary: string;
  try {
    binary = atob(payload);
  } catch {
    throw new Error(INVALID_IMAGE);
  }
  if (binary.length === 0 || binary.length > MAX_BYTES) throw new Error(INVALID_IMAGE);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const mime = `image/${type}`;
  return { blob: new Blob([bytes], { type: mime }), mime, ext: EXTENSION[type] };
}

// ---------------------------------------------------------------------------
// URLs firmadas
// ---------------------------------------------------------------------------

export interface MediaRef {
  bucket: ProfileBucket;
  path: string | null | undefined;
}

export interface SignedUrlResolver {
  resolve(bucket: ProfileBucket, path: string | null | undefined): Promise<string | null>;
  /** Firma varias rutas con una llamada por bucket; conserva el orden y devuelve null donde falla. */
  resolveMany(refs: MediaRef[]): Promise<(string | null)[]>;
  /** Descarta una ruta de la caché (p. ej. tras reemplazarla). */
  forget(bucket: ProfileBucket, path: string): void;
  clear(): void;
}

export interface SignedUrlOptions {
  ttlSeconds?: number;
  now?: () => number;
}

/** La URL se renueva cuando le queda menos de esta fracción de su vida. */
const REFRESH_FRACTION = 0.1;

export function createSignedUrlResolver(
  client: VexaSupabase,
  { ttlSeconds = 3600, now = Date.now }: SignedUrlOptions = {},
): SignedUrlResolver {
  const cache = new Map<string, { url: string; expiresAt: number }>();
  const key = (bucket: string, path: string) => `${bucket}/${path}`;

  const fresh = (bucket: string, path: string): string | null => {
    const hit = cache.get(key(bucket, path));
    if (!hit) return null;
    return hit.expiresAt - now() > ttlSeconds * 1000 * REFRESH_FRACTION ? hit.url : null;
  };

  async function sign(bucket: ProfileBucket, paths: string[]) {
    try {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrls(paths, ttlSeconds);
      if (error || !data) return;
      const signedAt = now();
      for (const item of data) {
        if (item.error || !item.path || !item.signedUrl) continue;
        cache.set(key(bucket, item.path), {
          url: item.signedUrl,
          expiresAt: signedAt + ttlSeconds * 1000,
        });
      }
    } catch {
      // Una foto que no se puede firmar nunca rompe la pantalla: se muestra sin foto.
    }
  }

  const resolveMany = async (refs: MediaRef[]) => {
    const missing = new Map<ProfileBucket, Set<string>>();
    for (const { bucket, path } of refs) {
      if (!path || fresh(bucket, path)) continue;
      missing.set(bucket, (missing.get(bucket) ?? new Set()).add(path));
    }
    await Promise.all([...missing].map(([bucket, paths]) => sign(bucket, [...paths])));
    return refs.map(({ bucket, path }) => (path ? fresh(bucket, path) : null));
  };

  return {
    async resolve(bucket, path) {
      return (await resolveMany([{ bucket, path }]))[0] ?? null;
    },
    resolveMany,
    forget: (bucket, path) => void cache.delete(key(bucket, path)),
    clear: () => cache.clear(),
  };
}

type ProfileRow = Tables<"profiles">;

/** Perfiles del dominio con `avatarUrl` y `bannerUrl` como URLs firmadas (null sin ruta o sin firma). */
export async function withSignedMedia(
  resolver: SignedUrlResolver,
  rows: ProfileRow[],
): Promise<Profile[]> {
  const urls = await resolver.resolveMany(
    rows.flatMap((row) => [
      { bucket: "avatars" as const, path: row.avatar_path },
      { bucket: "banners" as const, path: row.banner_path },
    ]),
  );
  return rows.map((row, index) => ({
    ...mapProfile(row),
    avatarUrl: urls[index * 2] ?? null,
    bannerUrl: urls[index * 2 + 1] ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Subida y baja
// ---------------------------------------------------------------------------

interface MediaTarget {
  userId: string;
  kind: ProfileImageKind;
}

export interface UploadProfileImageInput extends MediaTarget {
  dataUrl: string;
  now?: () => number;
}

/** Errores de la API de Storage (tamaño, tipo) con el mensaje de la interfaz. */
function toStorageError(error: unknown): Error {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : "";
  if (/exceed|too large|maximum allowed|mime|not supported|413/i.test(message))
    return new Error(INVALID_IMAGE, { cause: error });
  return toServiceError(error);
}

async function currentPath(client: VexaSupabase, { userId, kind }: MediaTarget) {
  const column = COLUMN[kind];
  const row = unwrapMaybe(
    await client.from("profiles").select(column).eq("id", userId).maybeSingle(),
  ) as Partial<Record<typeof column, string | null>> | null;
  return row?.[column] ?? null;
}

/** Retira un objeto sin que un fallo cambie el resultado: el objeto viejo queda huérfano, nada más. */
async function removeQuietly(client: VexaSupabase, bucket: ProfileBucket, path: string | null) {
  if (!path) return;
  try {
    await client.storage.from(bucket).remove([path]);
  } catch {
    // Mejor esfuerzo.
  }
}

/** Sube la imagen, guarda su ruta con la RPC y retira la anterior. Devuelve la fila del perfil. */
export async function uploadProfileImage(
  client: VexaSupabase,
  { userId, kind, dataUrl, now = Date.now }: UploadProfileImageInput,
): Promise<ProfileRow> {
  const { blob, mime, ext } = dataUrlToBlob(dataUrl);
  const bucket = BUCKET[kind];
  const previous = await currentPath(client, { userId, kind });
  const path = `${userId}/${kind}-${now()}.${ext}`;

  const { error: uploadError } = await client.storage
    .from(bucket)
    .upload(path, blob, { contentType: mime, upsert: false });
  if (uploadError) throw toStorageError(uploadError);

  const args = kind === "avatar" ? { p_avatar_path: path } : { p_banner_path: path };
  const result = await client.rpc("set_profile_media", args);
  if (result.error || !result.data) {
    await removeQuietly(client, bucket, path);
    throw toServiceError(result.error ?? { message: "El servidor no devolvió datos" });
  }
  if (previous && previous !== path) await removeQuietly(client, bucket, previous);
  return result.data as ProfileRow;
}

/** Quita la foto o el banner y retira el objeto. */
export async function clearProfileImage(
  client: VexaSupabase,
  { userId, kind }: MediaTarget,
): Promise<ProfileRow> {
  const previous = await currentPath(client, { userId, kind });
  const args = kind === "avatar" ? { p_clear_avatar: true } : { p_clear_banner: true };
  const row = unwrap(await client.rpc("set_profile_media", args)) as ProfileRow;
  await removeQuietly(client, BUCKET[kind], previous);
  return row;
}
