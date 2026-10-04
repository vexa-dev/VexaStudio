import { formatIsoDate, todayLima } from "@vexa/domain/dates";

export interface DayGroup<T> {
  /** Día de Lima como `YYYY-MM-DD`. */
  key: string;
  /** "Hoy", "Ayer" o `dd/mm/yyyy`. */
  label: string;
  items: T[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Agrupa por día de Lima respetando el orden recibido (más reciente primero).
 * Lima no tiene horario de verano, así que "ayer" es exactamente 24 h antes de "hoy".
 */
export function groupByDay<T extends { occurredAt: string }>(
  items: T[],
  now: Date = new Date(),
): DayGroup<T>[] {
  const today = todayLima(now);
  const yesterday = todayLima(new Date(now.getTime() - DAY_MS));
  const groups: DayGroup<T>[] = [];
  for (const item of items) {
    const key = todayLima(new Date(item.occurredAt));
    const last = groups.at(-1);
    if (last?.key === key) {
      last.items.push(item);
      continue;
    }
    groups.push({
      key,
      label:
        key === today ? "Hoy" : key === yesterday ? "Ayer" : formatIsoDate(key),
      items: [item],
    });
  }
  return groups;
}
