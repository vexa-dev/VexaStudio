import { useMemo, useState, type ReactNode } from "react";
import type { AuditLogEntry } from "@vexa/domain/audit";
import { formatDateTimeSeconds } from "@vexa/domain/format";
import { Badge } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { roleLabel } from "@/lib/labels";
import { useActivityNames } from "../hooks/useActivityNames";
import { clientLabel, diffRows } from "../lib/diff-rows";
import {
  categoryLabel,
  eventCategory,
  eventPhrase,
} from "../lib/event-copy";
import { truncateText } from "../lib/format-value";

const MAX_VALUE_CHARS = 140;

/** Valor de una celda: los textos largos se recortan y se pueden expandir. */
function ValueText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const { text: short, truncated } = truncateText(text, MAX_VALUE_CHARS);
  return (
    <>
      <span className="[overflow-wrap:anywhere]">
        {expanded ? text : short}
      </span>
      {truncated ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
          className="-my-2 ml-1 inline-flex min-h-11 items-center px-1 text-xs text-primary-text underline"
        >
          {expanded ? "Ver menos" : "Ver más"}
        </button>
      ) : null}
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function DetailBody({ entry }: { entry: AuditLogEntry }) {
  const names = useActivityNames();
  const projects = useProjects();
  const resolve = useMemo(() => {
    const byProject = new Map((projects.data ?? []).map((p) => [p.id, p.name]));
    return (id: string) => names.memberName(id) ?? byProject.get(id);
  }, [names, projects.data]);
  const rows = diffRows(entry.changes, resolve);
  const actor = names.actorFullName(entry.actorId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Badge className="self-start">
          {categoryLabel[eventCategory(entry.eventType)]}
        </Badge>
        <p className="text-base font-medium [overflow-wrap:anywhere]">
          {eventPhrase(entry, {
            actorName: names.actorName(entry.actorId),
            memberName: names.memberName,
          })}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="Quién">
          {actor} · {roleLabel[entry.actorRole] ?? entry.actorRole} (rol en ese momento)
        </Detail>
        <Detail label="Cuándo (Lima)">
          <span className="num">{formatDateTimeSeconds(entry.occurredAt)}</span>
          <span className="num block text-xs text-muted">
            UTC {entry.occurredAt}
          </span>
        </Detail>
        <Detail label="Registro afectado">
          {entry.entity.label || "Sin nombre"}
        </Detail>
        <Detail label="Plataforma">{clientLabel(entry.client)}</Detail>
        <Detail label="Solicitud">
          <code className="num text-xs">{entry.requestId}</code>
        </Detail>
        {entry.reason ? <Detail label="Motivo">{entry.reason}</Detail> : null}
      </dl>

      <section aria-labelledby="activity-changes">
        <h3 id="activity-changes" className="mb-2 text-sm font-semibold">
          Cambios
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Este evento no registró cambios de campos.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
              <caption className="sr-only">
                Campos modificados, con su valor antes y después
              </caption>
              <thead className="bg-surface-2 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Campo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Antes</th>
                  <th scope="col" className="px-3 py-2 font-medium">Después</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.field} className="border-t border-border align-top">
                    <th scope="row" className="px-3 py-2 font-medium">
                      {row.label}
                    </th>
                    <td className="px-3 py-2">
                      <span aria-hidden="true" className="mr-1 font-semibold text-danger">−</span>
                      <span className="sr-only">Antes: </span>
                      <ValueText text={row.before} />
                    </td>
                    <td className="px-3 py-2">
                      <span aria-hidden="true" className="mr-1 font-semibold text-success">+</span>
                      <span className="sr-only">Después: </span>
                      <ValueText text={row.after} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Detalle de una entrada: quién, cuándo, datos técnicos y la tabla campo / antes / después. */
export function ActivityDetailSheet({
  entry,
  onClose,
}: {
  entry: AuditLogEntry | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={Boolean(entry)}
      onClose={onClose}
      title="Detalle de actividad"
    >
      {entry ? <DetailBody key={entry.id} entry={entry} /> : null}
    </Sheet>
  );
}
