import type {
  ProjectLabel,
  HoursDraft,
  Absence,
  Announcement,
  Comment,
  DailyUpdate,
  Expense,
  ExpenseVote,
  Id,
  Meeting,
  MeetingSlot,
  Notification,
  Profile,
  Project,
  RecurringExpense,
  Settings,
  SlotVote,
  Sprint,
  Task,
  TimeEntry,
} from "@vexa/domain/types";
import {
  diffFields,
  entityLabel,
  entityProjectId,
  taskEventType,
  type AuditEventType,
  type AuditLogEntry,
  type AuditSnapshot,
  type AuditTable,
} from "@vexa/domain/audit";
import { buildDayPlanningTasks, buildSeed } from "./seed";

/** Base de datos simulada en memoria; una colección por tabla del modelo del PRD. */
export interface MockDb {
  dayPlanningTasksSeeded?: boolean;
  hoursDrafts?: HoursDraft[];
  /** Bytes (data URL) of the files attached to hours, by evidence id. Kept apart from the entries. */
  evidenceFiles?: Record<Id, string>;
  projectLabels?: ProjectLabel[];
  profiles: Profile[];
  settings: Settings;
  projects: Project[];
  sprints: Sprint[];
  tasks: Task[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  expenseVotes: ExpenseVote[];
  recurringExpenses: RecurringExpense[];
  dailyUpdates: DailyUpdate[];
  comments: Comment[];
  announcements: Announcement[];
  absences: Absence[];
  notifications: Notification[];
  auditLog: AuditLogEntry[];
  meetings: Meeting[];
  meetingSlots: MeetingSlot[];
  slotVotes: SlotVote[];
}

/** Sube la versión cuando cambie la forma de `MockDb`: descarta lo guardado y vuelve a sembrar. */
const SCHEMA_VERSION = 1;
const DB_KEY = "vexa-studio.mock.db";
const SESSION_KEY = "vexa-studio.mock.session";

interface Stored {
  version: number;
  db: MockDb;
}

let cache: MockDb | null = null;
let persistedRaw: string | null = null;

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sin localStorage (modo privado, cuota): la base sigue viva en memoria.
  }
}

function load(): MockDb {
  const raw = readStorage(DB_KEY);
  if (raw) {
    try {
      persistedRaw = raw;
      const stored = JSON.parse(raw) as Stored;
      if (stored.version === SCHEMA_VERSION) return migrate(stored.db);
    } catch {
      // JSON corrupto: se vuelve a sembrar.
    }
  }
  const db = migrate(buildSeed(new Date()));
  persist(db);
  return db;
}

/** Entrada del formato anterior al registro de actividad (tabla, acción, antes, después). */
interface LegacyAuditEntry {
  id: Id;
  table: string;
  recordId: Id;
  action: "create" | "update" | "void";
  before: AuditSnapshot | null;
  after: AuditSnapshot | null;
  userId: Id;
  createdAt: string;
}

const LEGACY_TABLES: AuditTable[] = [
  "tasks",
  "projects",
  "project_labels",
  "sprints",
  "time_entries",
];

function legacyEventType(
  table: AuditTable,
  action: LegacyAuditEntry["action"],
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): AuditEventType {
  if (table === "tasks" && after) return taskEventType(before, after);
  if (table === "time_entries") {
    if (action === "create") return "hours.created";
    if (action === "void") return "hours.voided";
    if (after?.validated && !before?.validated) return "hours.approved";
    if (after?.reviewNote && !before?.reviewNote)
      return "hours.clarification_requested";
    return "hours.edited";
  }
  const base =
    table === "project_labels" ? "project_label" : table.slice(0, -1);
  return `${base}.${action === "create" ? "created" : "updated"}` as AuditEventType;
}

/** Convierte lo guardado con el formato anterior; el orden original define `seq`. */
export function migrateAuditLog(
  entries: (AuditLogEntry | LegacyAuditEntry)[],
  profiles: Pick<MockDb["profiles"][number], "id" | "role">[],
): AuditLogEntry[] {
  const migrated: AuditLogEntry[] = [];
  for (const entry of entries) {
    if ("eventType" in entry) {
      migrated.push(entry);
      continue;
    }
    const table = entry.table as AuditTable;
    const record = entry.after ?? entry.before;
    if (!LEGACY_TABLES.includes(table) || !record) continue;
    migrated.push({
      id: entry.id,
      seq: migrated.length + 1,
      occurredAt: entry.createdAt,
      clientAt: null,
      actorId: entry.userId,
      actorRole:
        profiles.find((p) => p.id === entry.userId)?.role ?? "collaborator",
      eventType: legacyEventType(
        table,
        entry.action,
        entry.before,
        entry.after,
      ),
      entity: {
        table,
        id: entry.recordId,
        projectId: entityProjectId(table, record),
        label: entityLabel(table, record),
      },
      changes: diffFields(entry.before, entry.after),
      before: entry.before,
      after: entry.after,
      reason:
        entry.action === "void" && typeof entry.after?.voidReason === "string"
          ? entry.after.voidReason
          : null,
      requestId: `r-legacy-${entry.id}`,
      sessionId: "s-legacy",
      client: { platform: "web", appVersion: "legacy" },
    });
  }
  return migrated;
}

const DEMO_JOINED_AT = "2026-03-02T14:00:00.000Z";
/** Fallback registration date for profiles persisted before `joinedAt` existed. */
const LEGACY_JOINED_AT = "2026-01-12T14:00:00.000Z";

function migrate(db: MockDb): MockDb {
  if (!db.dayPlanningTasksSeeded) {
    const planningTasks = buildDayPlanningTasks().filter(
      (task) => !db.tasks.some((existing) => existing.id === task.id),
    );
    db.tasks.unshift(...planningTasks);
    db.dayPlanningTasksSeeded = true;
  }
  for (const profile of db.profiles)
    profile.joinedAt ??=
      profile.id === "u-demo-collaborator" ? DEMO_JOINED_AT : LEGACY_JOINED_AT;
  db.auditLog = migrateAuditLog(db.auditLog ?? [], db.profiles);
  db.hoursDrafts ??= [];
  db.projectLabels ??= [];
  db.evidenceFiles ??= {};
  // Entries saved before tags and evidence existed get empty lists (additive migration).
  for (const entry of db.timeEntries) {
    entry.participants ??= [];
    entry.evidence ??= [];
  }
  // Add a dedicated demo collaborator without changing existing profiles or work.
  if (!db.profiles.some((p) => p.id === "u-demo-collaborator")) {
    db.profiles.push({
      id: "u-demo-collaborator",
      name: "Alex · Colaborador demo",
      role: "collaborator",
      area: "technical",
      weeklyHours: 15,
      active: true,
      joinedAt: DEMO_JOINED_AT,
    });
    db.tasks.push(
      {
        id: "t-demo-member",
        title: "Revisar navegación del estudio",
        projectId: "p-vexa",
        sprintId: null,
        assigneeId: "u-demo-collaborator",
        estimateHours: 2,
        status: "todo",
        link: null,
      },
      {
        id: "t-demo-external",
        title: "Revisar textos de Fivuza",
        projectId: "p-fivuza",
        sprintId: null,
        assigneeId: "u-demo-collaborator",
        estimateHours: 1,
        status: "todo",
        link: null,
      },
      {
        id: "t-demo-independent",
        title: "Preparar notas de la reunión",
        projectId: null,
        sprintId: null,
        assigneeId: "u-demo-collaborator",
        estimateHours: 1,
        status: "todo",
        link: null,
      },
    );
    const studio = db.projects.find((p) => p.id === "p-vexa");
    if (studio)
      studio.memberIds = [
        ...new Set([
          ...(studio.memberIds ??
            db.profiles
              .filter((p) => p.role !== "collaborator")
              .map((p) => p.id)),
          "u-demo-collaborator",
        ]),
      ];
  }
  for (const p of db.projects)
    p.memberIds ??= db.profiles
      .filter((u) => u.role !== "collaborator")
      .map((u) => u.id);
  return db;
}

if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key === DB_KEY) cache = null;
    if (event.key === SESSION_KEY) session = undefined;
  });

function persist(db: MockDb): void {
  const serialized = JSON.stringify({
    version: SCHEMA_VERSION,
    db,
  } satisfies Stored);
  writeStorage(DB_KEY, serialized);
  persistedRaw = readStorage(DB_KEY);
}

/** Base viva. Después de mutarla, llamar a `save()`. */
export function getDb(): MockDb {
  const raw = readStorage(DB_KEY);
  if (cache && raw !== persistedRaw) cache = null;
  cache ??= load();
  return cache;
}

export function save(): void {
  if (cache) persist(cache);
}

/** Sesión en memoria (espejo de localStorage): permite probar sin navegador y evita lecturas repetidas. */
let session: Id | null | undefined;

/** Borra los datos y la sesión simulados y vuelve al seed. */
export function resetMock(): void {
  cache = null;
  session = undefined;
  writeStorage(DB_KEY, null);
  writeStorage(SESSION_KEY, null);
}

export function getSessionUserId(): Id | null {
  session ??= readStorage(SESSION_KEY);
  return session;
}

export function setSessionUserId(userId: Id | null): void {
  session = userId;
  writeStorage(SESSION_KEY, userId);
}
