import type {
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
} from '@/domain/types'
import { buildSeed } from './seed'

/** Base de datos simulada en memoria; una colección por tabla del modelo del PRD. */
export interface MockDb {
  profiles: Profile[]
  settings: Settings
  projects: Project[]
  sprints: Sprint[]
  tasks: Task[]
  timeEntries: TimeEntry[]
  expenses: Expense[]
  expenseVotes: ExpenseVote[]
  recurringExpenses: RecurringExpense[]
  dailyUpdates: DailyUpdate[]
  comments: Comment[]
  announcements: Announcement[]
  absences: Absence[]
  notifications: Notification[]
  auditLog: AuditLogEntry[]
  meetings: Meeting[]
  meetingSlots: MeetingSlot[]
  slotVotes: SlotVote[]
}

/** Sube la versión cuando cambie la forma de `MockDb`: descarta lo guardado y vuelve a sembrar. */
const SCHEMA_VERSION = 1
const DB_KEY = 'vexa-studio.mock.db'
const SESSION_KEY = 'vexa-studio.mock.session'

interface Stored {
  version: number
  db: MockDb
}

let cache: MockDb | null = null

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Sin localStorage (modo privado, cuota): la base sigue viva en memoria.
  }
}

function load(): MockDb {
  const raw = readStorage(DB_KEY)
  if (raw) {
    try {
      const stored = JSON.parse(raw) as Stored
      if (stored.version === SCHEMA_VERSION) return stored.db
    } catch {
      // JSON corrupto: se vuelve a sembrar.
    }
  }
  const db = buildSeed(new Date())
  persist(db)
  return db
}

function persist(db: MockDb): void {
  writeStorage(DB_KEY, JSON.stringify({ version: SCHEMA_VERSION, db } satisfies Stored))
}

/** Base viva. Después de mutarla, llamar a `save()`. */
export function getDb(): MockDb {
  cache ??= load()
  return cache
}

export function save(): void {
  if (cache) persist(cache)
}

/** Borra los datos y la sesión simulados y vuelve al seed. */
export function resetMock(): void {
  cache = null
  writeStorage(DB_KEY, null)
  writeStorage(SESSION_KEY, null)
}

export function getSessionUserId(): Id | null {
  return readStorage(SESSION_KEY)
}

export function setSessionUserId(userId: Id | null): void {
  writeStorage(SESSION_KEY, userId)
}
