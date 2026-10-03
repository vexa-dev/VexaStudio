import type { Id, IsoDateTime, Role } from "./types";

/**
 * Registro de actividad: entradas inmutables que solo se agregan.
 * El mock las escribe dentro de cada operación de servicio; Supabase lo hará con triggers.
 */
export const AUDIT_EVENT_TYPES = [
  "task.created",
  "task.edited",
  "task.moved",
  "task.assigned",
  "project.created",
  "project.updated",
  "project.members_changed",
  "project_label.created",
  "project_label.updated",
  "sprint.created",
  "hours.created",
  "hours.confirmed",
  "hours.edited",
  "hours.approved",
  "hours.clarification_requested",
  "hours.voided",
  "timer.started",
  "timer.stopped",
  "timer.paused",
  "timer.resumed",
  "timer.recovered",
  "member.created",
  "member.updated",
  "member.role_changed",
  "member.deactivated",
  "settings.changed",
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

/** Tablas (o colecciones) sobre las que se registra actividad. */
export type AuditTable =
  | "tasks"
  | "projects"
  | "project_labels"
  | "sprints"
  | "time_entries"
  | "profiles"
  | "settings";

/** Diferencia de un campo entre el estado anterior y el posterior. */
export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** Registro afectado, con una foto de su nombre para que el historial siga legible si cambia. */
export interface AuditEntity {
  table: AuditTable;
  id: Id;
  projectId: Id | null;
  label: string;
}

export type ClientPlatform = "web" | "desktop" | "mobile";
export interface AuditClient {
  platform: ClientPlatform;
  appVersion: string;
}

export type AuditSnapshot = Record<string, unknown>;

export interface AuditLogEntry {
  id: Id;
  /** Orden monótono sin huecos: base de la paginación. */
  seq: number;
  /** Hora del servidor (o del mock). */
  occurredAt: IsoDateTime;
  /** Hora del reloj del cliente, si la informó. */
  clientAt: IsoDateTime | null;
  actorId: Id;
  /** Rol del actor en el momento de la acción. */
  actorRole: Role;
  eventType: AuditEventType;
  entity: AuditEntity;
  changes: AuditChange[];
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
  reason: string | null;
  /** Comparten valor todas las entradas de una misma operación de servicio. */
  requestId: Id;
  sessionId: Id;
  client: AuditClient;
}

/** Texto canónico con claves ordenadas: dos valores con el mismo contenido dan el mismo texto. */
function stable(value: unknown): string {
  return JSON.stringify(value ?? null, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        )
      : v,
  );
}

/** Copia profunda de datos JSON, para que los cambios no compartan referencias. */
function clone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}

/**
 * Cambios campo a campo entre dos estados. Un campo ausente cuenta como `null`;
 * los valores anidados se comparan por contenido. `before` nulo es una creación.
 */
export function diffFields(
  before: object | null,
  after: object | null,
  options: { ignore?: readonly string[] } = {},
): AuditChange[] {
  const from = (before ?? {}) as AuditSnapshot;
  const to = (after ?? {}) as AuditSnapshot;
  const fields = [...new Set([...Object.keys(from), ...Object.keys(to)])];
  const changes: AuditChange[] = [];
  for (const field of fields) {
    if (options.ignore?.includes(field)) continue;
    if (stable(from[field]) === stable(to[field])) continue;
    changes.push({
      field,
      from: clone(from[field]),
      to: clone(to[field]),
    });
  }
  return changes;
}

/** Evento de una tarea según lo que cambió: mover, asignar o editar. */
export function taskEventType(
  before: object | null,
  after: object,
): AuditEventType {
  if (before === null) return "task.created";
  const fields = diffFields(before, after).map((c) => c.field);
  if (fields.length === 1 && fields[0] === "status") return "task.moved";
  if (fields.length === 1 && fields[0] === "assigneeId") return "task.assigned";
  return "task.edited";
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** Nombre visible del registro, para guardarlo como foto en el historial. */
export function entityLabel(table: AuditTable, record: object): string {
  const r = record as AuditSnapshot;
  switch (table) {
    case "tasks":
      return text(r.title);
    case "projects":
    case "project_labels":
    case "profiles":
      return text(r.name);
    case "sprints":
      return text(r.goal);
    case "time_entries":
      return text(r.description) || "Registro de horas";
    case "settings":
      return "Ajustes";
  }
}

/** Proyecto al que pertenece el registro, si tiene uno. */
export function entityProjectId(table: AuditTable, record: object): Id | null {
  const r = record as AuditSnapshot;
  if (table === "projects") return text(r.id) || null;
  if (
    table === "tasks" ||
    table === "project_labels" ||
    table === "sprints" ||
    table === "time_entries"
  )
    return text(r.projectId) || null;
  return null;
}
