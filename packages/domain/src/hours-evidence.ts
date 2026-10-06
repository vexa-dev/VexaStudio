import type { HoursEvidence } from './types'

/** Files per entry. */
export const EVIDENCE_MAX_FILES = 5
/** Bytes per file in Supabase (the mock uses a lower cap, see the mock service). */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024
/** Days a file is kept after its entry is validated. Keep in sync with `private.evidence_retention_days()`. */
export const EVIDENCE_RETENTION_DAYS = 7

/** Closed allow-list (same as the bucket `hours-evidence`): no executables, no svg, no html. */
export const EVIDENCE_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/csv',
]

const BLOCKED_EXTENSION =
  /\.(exe|dll|bat|cmd|com|msi|sh|js|mjs|jar|svg|svgz|html?|apk|scr|ps1|vbs|app|dmg|bin)$/i

/**
 * Checks a file before uploading it (name, type and size). Throws the same messages as the SQL guard
 * `private.evidence_guard()`. `maxBytes` lets the mock use a smaller cap.
 */
export function validateEvidenceFile(
  file: { name: string; type: string; size: number },
  maxBytes: number = EVIDENCE_MAX_BYTES,
): void {
  const name = file.name.trim()
  if (name.length < 1 || name.length > 255 || /[/\\]/.test(name))
    throw new Error('El nombre del archivo debe tener de 1 a 255 caracteres.')
  if (!EVIDENCE_MIME_TYPES.includes(file.type) || BLOCKED_EXTENSION.test(name))
    throw new Error('Este tipo de archivo no está permitido.')
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > maxBytes)
    throw new Error('El archivo está vacío o pesa demasiado.')
}

/** When a file validated at `validatedAt` becomes eligible for deletion. */
export function evidencePurgeAt(validatedAt: Date): string {
  return new Date(
    validatedAt.getTime() + EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
}

/** The file is past its retention date and still stored. */
export function isEvidenceDue(
  evidence: Pick<HoursEvidence, 'purgeAt' | 'purged'>,
  now: Date,
): boolean {
  return !evidence.purged && !!evidence.purgeAt && Date.parse(evidence.purgeAt) <= now.getTime()
}
