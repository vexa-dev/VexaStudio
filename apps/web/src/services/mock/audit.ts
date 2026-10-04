import {
  diffFields,
  entityLabel,
  entityProjectId,
  type AuditClient,
  type AuditEventType,
  type AuditLogEntry,
  type AuditSnapshot,
  type AuditTable,
} from "@vexa/domain/audit";
import type { Id, Profile } from "@vexa/domain/types";
import type { AuditFilter, AuditService } from "@vexa/services";
import { getDb, getSessionUserId } from "./db";
import { delay } from "./utils";

/** Datos del cliente que el mock adjunta a cada entrada; en Supabase los envía la aplicación. */
export const MOCK_CLIENT: AuditClient = {
  platform: "web",
  appVersion: "0.0.0",
};

/** Una sesión por carga de la aplicación. */
const SESSION_ID = `s-${crypto.randomUUID()}`;

let activeRequest: Id | null = null;

/**
 * Agrupa bajo un mismo `requestId` todo lo que escribe una operación de servicio.
 * Solo abarca la parte síncrona de la operación, que es donde el mock muta y audita.
 */
export function withRequest<T>(operation: () => T): T {
  if (activeRequest) return operation();
  activeRequest = `r-${crypto.randomUUID()}`;
  try {
    return operation();
  } finally {
    activeRequest = null;
  }
}

/** Envuelve cada método de un servicio con `withRequest`. */
export function scoped<T extends object>(service: T): T {
  const wrapped = Object.entries(service).map(([name, member]) => [
    name,
    typeof member === "function"
      ? (...args: unknown[]) =>
          withRequest(() => (member as (...a: unknown[]) => unknown)(...args))
      : member,
  ]);
  return Object.fromEntries(wrapped) as T;
}

export interface RecordAuditInput {
  eventType: AuditEventType;
  table: AuditTable;
  actorId: Id;
  /** Estado anterior; `null` en una creación. */
  before: object | null;
  /** Estado posterior; `null` si el registro desaparece. */
  after: object | null;
  reason?: string | null;
  /** Sustituye al nombre y proyecto derivados del registro. */
  label?: string;
  projectId?: Id | null;
}

/**
 * Agrega una entrada al registro. Una edición sin cambios no deja rastro y devuelve `null`.
 * Es lo único que escribe `auditLog`: el servicio expuesto es de solo lectura.
 */
export function recordAudit(input: RecordAuditInput): AuditLogEntry | null {
  const db = getDb();
  const record = (input.after ?? input.before) as { id: Id } | null;
  if (!record) throw new Error("La actividad necesita un registro");
  const changes = diffFields(input.before, input.after);
  if (input.before && input.after && changes.length === 0) return null;
  const seq = (db.auditLog.at(-1)?.seq ?? 0) + 1;
  const entry: AuditLogEntry = {
    id: `au-${seq}-${Math.random().toString(36).slice(2, 6)}`,
    seq,
    occurredAt: new Date().toISOString(),
    clientAt: null,
    actorId: input.actorId,
    actorRole:
      db.profiles.find((p) => p.id === input.actorId)?.role ?? "collaborator",
    eventType: input.eventType,
    entity: {
      table: input.table,
      id: record.id,
      projectId:
        input.projectId !== undefined
          ? input.projectId
          : entityProjectId(input.table, record),
      label: input.label ?? entityLabel(input.table, record),
    },
    changes,
    before: input.before
      ? (structuredClone(input.before) as AuditSnapshot)
      : null,
    after: input.after ? (structuredClone(input.after) as AuditSnapshot) : null,
    reason: input.reason ?? null,
    requestId: activeRequest ?? `r-${crypto.randomUUID()}`,
    sessionId: SESSION_ID,
    client: MOCK_CLIENT,
  };
  db.auditLog.push(entry);
  return entry;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function viewer(): Profile {
  const id = getSessionUserId();
  const user = getDb().profiles.find((p) => p.id === id && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

/** Admin ve todo; socio, sus proyectos y sus acciones; colaborador, solo sus acciones. */
function visibleTo(user: Profile): AuditLogEntry[] {
  const log = getDb().auditLog;
  if (user.role === "admin") return log;
  const own = (entry: AuditLogEntry) => entry.actorId === user.id;
  if (user.role === "collaborator") return log.filter(own);
  const projectIds = new Set(
    getDb()
      .projects.filter((p) => p.memberIds?.includes(user.id))
      .map((p) => p.id),
  );
  return log.filter(
    (entry) =>
      own(entry) ||
      (entry.entity.projectId !== null &&
        projectIds.has(entry.entity.projectId)),
  );
}

function matches(entry: AuditLogEntry, filter: AuditFilter): boolean {
  const at = Date.parse(entry.occurredAt);
  return (
    (!filter.actorId || entry.actorId === filter.actorId) &&
    (!filter.projectId || entry.entity.projectId === filter.projectId) &&
    (!filter.entityTable || entry.entity.table === filter.entityTable) &&
    (!filter.entityId || entry.entity.id === filter.entityId) &&
    (!filter.eventTypes?.length ||
      filter.eventTypes.includes(entry.eventType)) &&
    (!filter.from || at >= Date.parse(filter.from)) &&
    (!filter.to || at <= Date.parse(filter.to))
  );
}

/** Lectura del registro. No hay escritura pública: solo `recordAudit` agrega entradas. */
export const auditService: AuditService = {
  async list(filter = {}, cursor = null, limit = DEFAULT_PAGE_SIZE) {
    const user = viewer();
    const size = Math.min(
      Math.max(Math.trunc(limit) || DEFAULT_PAGE_SIZE, 1),
      MAX_PAGE_SIZE,
    );
    const rest = visibleTo(user)
      .filter((e) => matches(e, filter) && (cursor === null || e.seq < cursor))
      .sort((a, b) => b.seq - a.seq);
    const items = rest.slice(0, size);
    return delay({
      items,
      nextCursor: rest.length > size ? (items.at(-1)?.seq ?? null) : null,
    });
  },
  async timeline(entity) {
    const user = viewer();
    return delay(
      visibleTo(user)
        .filter(
          (e) => e.entity.table === entity.table && e.entity.id === entity.id,
        )
        .sort((a, b) => b.seq - a.seq),
    );
  },
};
