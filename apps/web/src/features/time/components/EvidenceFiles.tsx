import { useId, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { EVIDENCE_MAX_FILES } from "@vexa/domain/hours-evidence";
import type { HoursEvidence } from "@vexa/domain/types";
import { Button } from "@/components/ui/Button";
import {
  EVIDENCE_RETENTION_TEXT,
  evidenceState,
  formatBytes,
  pickEvidenceFiles,
  storedEvidence,
} from "../evidence-files";
import {
  evidenceMaxBytes,
  useAddEvidence,
  useOpenEvidence,
  useRemoveEvidence,
} from "../hooks/useTime";
import { toast } from "sonner";

const ACCEPT = ".png,.jpg,.jpeg,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv";

/** File picker that validates before handing the files over; also usable for files queued before the entry exists. */
export function EvidencePicker({
  existing,
  busy = false,
  onFiles,
}: {
  /** Files already stored or queued, to enforce the cap. */
  existing: number;
  busy?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const full = existing >= EVIDENCE_MAX_FILES;
  const limit = evidenceMaxBytes();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Adjuntar archivos
      </label>
      <input
        id={id}
        ref={input}
        type="file"
        multiple
        accept={ACCEPT}
        disabled={busy || full}
        aria-describedby={`${id}-hint`}
        className="min-h-11 w-full rounded-lg border border-dashed border-[var(--control-border)] bg-[var(--input)] px-3 py-2 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-fg disabled:opacity-60"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (!picked.length) return;
          const { accepted, errors } = pickEvidenceFiles(picked, existing, limit);
          for (const message of errors) toast.error(message);
          if (accepted.length) onFiles(accepted);
        }}
      />
      <p id={`${id}-hint`} className="text-xs text-muted">
        {full
          ? `Llegaste al máximo de ${EVIDENCE_MAX_FILES} archivos.`
          : `Hasta ${EVIDENCE_MAX_FILES} archivos de ${formatBytes(limit)} cada uno.`}
      </p>
    </div>
  );
}

/** Files already stored on an entry; the owner can add or remove them while the entry is editable. */
export function EvidenceFiles({
  entryId,
  evidence,
  editable,
}: {
  entryId: string;
  evidence: HoursEvidence[] | undefined;
  editable: boolean;
}) {
  const add = useAddEvidence();
  const remove = useRemoveEvidence();
  const open = useOpenEvidence();
  const [uploading, setUploading] = useState(0);
  const [now] = useState(() => new Date());
  const list = evidence ?? [];
  const stored = storedEvidence(list);
  const purged = list.length - stored.length;

  async function upload(files: File[]) {
    setUploading(files.length);
    let ok = 0;
    for (const file of files) {
      try {
        await add.mutateAsync({ entryId, file, silent: true });
        ok += 1;
      } catch {
        /* The hook already reported this file. */
      }
    }
    setUploading(0);
    if (ok) toast.success(ok === 1 ? "Archivo adjuntado" : `${ok} archivos adjuntados`);
  }

  return (
    <section className="flex flex-col gap-2" aria-label="Archivos de respaldo">
      <h4 className="text-sm font-medium">Archivos de respaldo</h4>
      {stored.length ? (
        <ul className="flex flex-col gap-2">
          {stored.map((file) => {
            const state = evidenceState(file, now);
            return (
              <li
                key={file.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2 p-2.5"
              >
                <FileText size={18} aria-hidden="true" className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-medium">{file.name}</span>
                  <span className="num text-xs text-muted">
                    {formatBytes(file.size)}
                    {state === "due" ? " · Se eliminarán pronto" : ""}
                  </span>
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-label={`Abrir ${file.name}`}
                  disabled={open.isPending}
                  onClick={() => open.mutate(file.id)}
                >
                  Abrir
                </Button>
                {editable ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Quitar ${file.name}`}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(file.id)}
                  >
                    <X size={16} aria-hidden="true" />
                    Quitar
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : purged ? null : (
        <p className="text-sm text-muted">Sin archivos adjuntos.</p>
      )}
      {purged ? (
        <p className="text-sm text-muted">
          <Paperclip size={14} aria-hidden="true" className="mr-1 inline" />
          Archivos eliminados{purged > 1 ? ` (${purged})` : ""}
        </p>
      ) : null}
      {editable ? (
        <>
          <EvidencePicker
            existing={stored.length}
            busy={uploading > 0}
            onFiles={upload}
          />
          {uploading > 0 ? (
            <output className="text-sm text-muted">
              Subiendo {uploading === 1 ? "1 archivo" : `${uploading} archivos`}…
            </output>
          ) : null}
        </>
      ) : null}
      <p className="text-xs text-muted">{EVIDENCE_RETENTION_TEXT}</p>
    </section>
  );
}
