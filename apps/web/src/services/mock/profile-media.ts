import type { Id, Profile } from "@vexa/domain/types";
import { getDb, getSessionUserId } from "./db";

const MEDIA_KEY = "vexa-studio.mock.profile-media";

/** Tope en caracteres del data URL (la UI ya recorta y comprime). */
export const MAX_PROFILE_IMAGE_LENGTH = 400_000;

const IMAGE_PREFIX = /^data:image\/(png|jpeg|webp|svg\+xml)[;,]/;

interface MediaEntry {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
}
type MediaMap = Record<Id, MediaEntry>;

/** Copia en memoria: respaldo si localStorage falla y evita relecturas. */
let cache: MediaMap | null = null;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin localStorage o sin cuota: las imágenes siguen vivas en memoria.
  }
}

function load(): MediaMap {
  if (cache) return cache;
  try {
    const raw = readStorage(MEDIA_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    cache =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as MediaMap)
        : {};
  } catch {
    cache = {};
  }
  return cache;
}

function save(map: MediaMap): void {
  cache = map;
  writeStorage(MEDIA_KEY, JSON.stringify(map));
}

/** Borra las fotos y banners simulados. */
export function resetProfileMedia(): void {
  cache = null;
  writeStorage(MEDIA_KEY, null);
}

/** Acepta solo data URLs de imagen y de tamaño razonable. */
export function validateProfileImage(value: string): void {
  if (!IMAGE_PREFIX.test(value) || value.length > MAX_PROFILE_IMAGE_LENGTH)
    throw new Error("La imagen no es válida o pesa demasiado.");
}

export function withMedia(profile: Profile): Profile {
  const media = load()[profile.id];
  return media ? { ...profile, ...media } : profile;
}

export function withMediaAll(profiles: Profile[]): Profile[] {
  return profiles.map(withMedia);
}

export function updateProfileMedia(patch: MediaEntry): Profile {
  const userId = getSessionUserId();
  const profile = userId
    ? getDb().profiles.find((p) => p.id === userId && p.active)
    : undefined;
  if (!profile) throw new Error("Inicia sesión para continuar");
  for (const value of [patch.avatarUrl, patch.bannerUrl])
    if (typeof value === "string") validateProfileImage(value);

  const map = { ...load() };
  const next: MediaEntry = { ...map[profile.id] };
  if (patch.avatarUrl !== undefined) next.avatarUrl = patch.avatarUrl;
  if (patch.bannerUrl !== undefined) next.bannerUrl = patch.bannerUrl;
  map[profile.id] = next;
  save(map);
  return withMedia(profile);
}
