import {
  EVIDENCE_MAX_FILES,
  isEvidenceDue,
  validateEvidenceFile,
} from "@vexa/domain/hours-evidence";
import type { HoursEvidence } from "@vexa/domain/types";

/** Per-file cap of the mock service. Keep in sync with `MOCK_EVIDENCE_MAX_BYTES` in `services/mock/hours-extras.ts`. */
export const MOCK_EVIDENCE_MAX_BYTES = 3 * 1024 * 1024;

type FileLike = { name: string; type: string; size: number };

export const EVIDENCE_RETENTION_TEXT =
  "Se eliminan 7 días después de aprobar las horas.";

/** `850 KB`, `2.4 MB`: sizes the way people read them. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export type EvidenceState = "available" | "due" | "purged";

export function evidenceState(
  evidence: Pick<HoursEvidence, "purgeAt" | "purged">,
  now: Date,
): EvidenceState {
  if (evidence.purged) return "purged";
  return isEvidenceDue(evidence, now) ? "due" : "available";
}

/** Files of an entry that are still stored. */
export const storedEvidence = (evidence: HoursEvidence[] | undefined) =>
  (evidence ?? []).filter((e) => !e.purged);

/**
 * Splits picked files into the ones that can be uploaded and the error messages of the others,
 * honoring the per-entry cap (`existing` counts files already stored or queued).
 */
export function pickEvidenceFiles<T extends FileLike>(
  files: T[],
  existing: number,
  maxBytes: number,
): { accepted: T[]; errors: string[] } {
  const accepted: T[] = [];
  const errors: string[] = [];
  for (const file of files) {
    if (existing + accepted.length >= EVIDENCE_MAX_FILES) {
      errors.push(`Máximo ${EVIDENCE_MAX_FILES} archivos por registro.`);
      break;
    }
    try {
      validateEvidenceFile(file, maxBytes);
      accepted.push(file);
    } catch (error) {
      errors.push(
        `${file.name}: ${error instanceof Error ? error.message : "no se puede adjuntar."}`,
      );
    }
  }
  return { accepted, errors };
}
