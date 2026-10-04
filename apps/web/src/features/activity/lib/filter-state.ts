import type { AuditFilter } from "@/services";
import { CATEGORY_EVENT_TYPES, type EventCategory } from "./event-copy";

/** Valor de la interfaz para "sin filtro" en los selectores; las fechas vacías son `""`. */
export const ALL = "all";

export interface ActivityFilterState {
  /** Identificador de la persona, o `ALL`. */
  actorId: string;
  /** Identificador del proyecto, o `ALL`. */
  projectId: string;
  category: EventCategory | typeof ALL;
  /** Día de Lima `YYYY-MM-DD`, o `""`. */
  from: string;
  to: string;
}

export const EMPTY_FILTERS: ActivityFilterState = {
  actorId: ALL,
  projectId: ALL,
  category: ALL,
  from: "",
  to: "",
};

/** Instante UTC del inicio o el fin de un día de Lima (UTC-5, sin horario de verano). */
const startOfLimaDay = (day: string) =>
  new Date(`${day}T00:00:00.000-05:00`).toISOString();
const endOfLimaDay = (day: string) =>
  new Date(`${day}T23:59:59.999-05:00`).toISOString();

/** Convierte el estado de la pantalla en el filtro del servicio. */
export function toAuditFilter(state: ActivityFilterState): AuditFilter {
  const filter: AuditFilter = {};
  if (state.actorId !== ALL) filter.actorId = state.actorId;
  if (state.projectId !== ALL) filter.projectId = state.projectId;
  if (state.category !== ALL)
    filter.eventTypes = CATEGORY_EVENT_TYPES[state.category];
  if (state.from) filter.from = startOfLimaDay(state.from);
  if (state.to) filter.to = endOfLimaDay(state.to);
  return filter;
}

/** Cantidad de filtros activos; el rango de fechas cuenta como uno. */
export function countActiveFilters(state: ActivityFilterState): number {
  return [
    state.actorId !== ALL,
    state.projectId !== ALL,
    state.category !== ALL,
    Boolean(state.from || state.to),
  ].filter(Boolean).length;
}
