import { createElement } from "react";
import type { AuditLogEntry } from "@vexa/domain/audit";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { useActivityNames } from "../hooks/useActivityNames";
import {
  categoryLabel,
  eventCategory,
  eventIcon,
  eventPhrase,
  timeOfDay,
} from "../lib/event-copy";

/**
 * Una entrada del registro: quién, qué hizo y a qué hora exacta (Lima, con segundos).
 * Es un botón que abre el detalle; el estado nunca depende solo del color: la categoría va en texto.
 */
export function ActivityRow({
  entry,
  onSelect,
}: {
  entry: AuditLogEntry;
  onSelect: (entry: AuditLogEntry) => void;
}) {
  const names = useActivityNames();
  const phrase = eventPhrase(entry, {
    actorName: names.actorName(entry.actorId),
    memberName: names.memberName,
  });
  return (
    <Card className="p-0! sm:p-0!">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onSelect(entry)}
        className="flex min-h-11 w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-surface-2"
      >
        <Avatar name={names.actorFullName(entry.actorId)} size="sm" />
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-sm [overflow-wrap:anywhere]">{phrase}</span>
          <span className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1">
              {createElement(eventIcon(entry.eventType), {
                className: "size-3",
                "aria-hidden": true,
              })}
              {categoryLabel[eventCategory(entry.eventType)]}
            </Badge>
            {entry.reason ? (
              <span className="min-w-0 truncate text-xs text-muted">
                Motivo: {entry.reason}
              </span>
            ) : null}
          </span>
        </span>
        <time
          className="num shrink-0 pt-0.5 text-xs text-muted"
          dateTime={entry.occurredAt}
          data-tooltip={entry.occurredAt}
        >
          {timeOfDay(entry.occurredAt)}
        </time>
      </button>
    </Card>
  );
}
