import type { AuditLogEntry } from "@vexa/domain/audit";
import { stagger } from "@/lib/utils";
import { groupByDay } from "../lib/group-by-day";
import { ActivityRow } from "./ActivityRow";

/** Solo las primeras filas entran escalonadas: las páginas que se cargan después aparecen sin animación. */
const ANIMATED_ROWS = 12;

/** Línea de tiempo: entradas agrupadas por día de Lima, la más reciente primero. */
export function ActivityTimeline({
  entries,
  onSelect,
  animate = false,
}: {
  entries: AuditLogEntry[];
  onSelect: (entry: AuditLogEntry) => void;
  /** `true` solo en la primera visita de la sesión (ver `useFirstPlay`). */
  animate?: boolean;
}) {
  let position = 0;
  return (
    <div className="flex flex-col gap-5">
      {groupByDay(entries).map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </h2>
          <ul className="flex flex-col gap-2">
            {group.items.map((entry) => {
              const index = position++;
              const enter = animate && index < ANIMATED_ROWS;
              return (
                <li
                  key={entry.id}
                  className={enter ? "enter" : undefined}
                  style={enter ? stagger(index) : undefined}
                >
                  <ActivityRow entry={entry} onSelect={onSelect} />
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
