import { Users } from "lucide-react";
import { formatHours } from "@vexa/domain/format";
import type { TimeEntry } from "@vexa/domain/types";
import { Badge } from "@/components/ui/Badge";
import { creditedHours, isTaggedIn } from "../analytics";

/** Chips with the people tagged on an entry and the hours each one is credited. */
export function EntryParticipants({
  entry,
  userId,
  nameOf,
}: {
  entry: TimeEntry;
  /** The person looking at the entry. */
  userId?: string;
  nameOf: (id: string) => string;
}) {
  const list = entry.participants ?? [];
  if (!list.length) return null;
  const mine = userId ? isTaggedIn(entry, userId) : false;
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      {mine ? (
        <Badge tone="primary">
          Etiquetado por {nameOf(entry.userId)}
          {userId ? (
            <span className="num ml-1">
              · te cuentan {formatHours(creditedHours(entry, userId))}
            </span>
          ) : null}
        </Badge>
      ) : null}
      {!mine ? (
        <Users size={14} aria-hidden="true" className="text-muted" />
      ) : null}
      {list
        .filter((p) => !mine || p.userId !== userId)
        .map((p) => (
          <Badge key={p.userId}>
            {nameOf(p.userId)}
            <span className="num ml-1">
              {p.sharePercent} % · {formatHours((entry.hours * p.sharePercent) / 100)}
            </span>
          </Badge>
        ))}
    </span>
  );
}
