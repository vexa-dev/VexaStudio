import type {
  ProjectLabel,
  HoursDraft,
  Absence,
  Announcement,
  AuditLogEntry,
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
import { buildSeed } from "./seed";

/** Base de datos simulada en memoria; una colección por tabla del modelo del PRD. */
export interface MockDb {
  hoursDrafts?: HoursDraft[];
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

function migrate(db: MockDb): MockDb {
  db.hoursDrafts ??= [];
  db.projectLabels ??= [];
  // Add a dedicated demo collaborator without changing existing profiles or work.
  if (!db.profiles.some((p) => p.id === "u-demo-collaborator")) {
    db.profiles.push({
      id: "u-demo-collaborator",
      name: "Alex · Colaborador demo",
      role: "collaborator",
      area: "technical",
      weeklyHours: 15,
      active: true,
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
