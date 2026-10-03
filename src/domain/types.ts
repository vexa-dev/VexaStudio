/**
 * Tipos del dominio. Reflejan el modelo de datos del PRD.
 * Fechas y horas: ISO 8601 en UTC (`IsoDateTime`). Fechas sin hora: `YYYY-MM-DD` en Lima (`IsoDate`).
 */
export type Id = string;
export type IsoDateTime = string;
export type IsoDate = string;
export type Role = "admin" | "partner" | "collaborator";
export type Area =
  "technical" | "management_finance" | "commercial" | "design_marketing";
export interface Profile {
  id: Id;
  name: string;
  role: Role;
  area: Area;
  /** Horas comprometidas por semana. */
  weeklyHours: number;
  active: boolean;
}

/** Parámetros del acuerdo de socios (tabla `settings`, en camelCase). */
export interface Settings {
  pointsPerHour: number;
  pointsPerSol: number;
  minCompliance: number;
  weeksPerMonth: number;
  expenseApprovalLimitPen: number;
  entryEditDays: number;
  dailyReminder: { time: string; weekdays: number[] };
  weeklyHoursReminder: { time: string; weekday: number };
}

export type ProjectType = "internal" | "product" | "client";
export type ProjectStatus = "active" | "paused" | "archived";
export interface Project {
  id: Id;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  memberIds?: Id[];
}

export type SprintStatus = "planned" | "active" | "closed";
export interface Sprint {
  id: Id;
  projectId: Id;
  startDate: IsoDate;
  endDate: IsoDate;
  goal: string;
  status: SprintStatus;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export interface ProjectLabel {
  id: Id;
  projectId: Id;
  name: string;
  color: string;
}

export interface Task {
  id: Id;
  sprintId: Id | null;
  projectId: Id | null;
  hoursPrepared?: boolean;
  description?: string;
  labels?: ProjectLabel[];
  title: string;
  status: TaskStatus;
  assigneeId: Id | null;
  estimateHours: number | null;
  /** Enlace a repositorio, PR o entregable. */
  link: string | null;
}

export interface TimeEntry {
  id: Id;
  userId: Id;
  taskId: Id | null;
  startedAt: IsoDateTime;
  /** `null` mientras el temporizador está abierto. */
  endedAt: IsoDateTime | null;
  hours: number;
  paid: boolean;
  validated: boolean;
  validatedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  voidedAt: IsoDateTime | null;
  voidReason: string | null;
  projectId?: Id | null;
  description?: string;
  evidenceUrl?: string | null;
  source?: "manual" | "timer";
  validatedBy?: Id | null;
  reviewNote?: string | null;
  reviewedBy?: Id | null;
  draft?: boolean;
  timerState?: "running" | "paused";
  elapsedMs?: number;
  segmentStartedAt?: string | null;
  segments?: { start: string; end: string }[];
  allocations?: {
    taskId: Id;
    title: string;
    projectId: Id | null;
    hours: number;
  }[];
}

export type ExpenseCategory =
  "infrastructure" | "software" | "marketing" | "legal" | "other";
export type ExpenseStatus = "pending" | "approved" | "rejected" | "voided";
export type Currency = "PEN" | "USD";
export interface Expense {
  id: Id;
  paidBy: Id;
  amount: number;
  currency: Currency;
  concept: string;
  category: ExpenseCategory;
  receiptUrl: string | null;
  status: ExpenseStatus;
  reimbursed: boolean;
  /** Gasto previo a la firma del acuerdo: no suma puntos. */
  beforeSigning: boolean;
  createdAt: IsoDateTime;
  voidReason: string | null;
}

export interface ExpenseVote {
  expenseId: Id;
  userId: Id;
  inFavor: boolean;
}

export type Periodicity = "monthly" | "yearly";
export interface RecurringExpense {
  id: Id;
  concept: string;
  amount: number;
  currency: Currency;
  nextDate: IsoDate;
  periodicity: Periodicity;
  beforeSigning: boolean;
}

export interface DailyUpdate {
  id: Id;
  userId: Id;
  date: IsoDate;
  done: string;
  willDo: string;
  blockers: string;
}

export type CommentEntity = "task" | "expense" | "time_entry";
export interface Comment {
  id: Id;
  entity: CommentEntity;
  entityId: Id;
  userId: Id;
  text: string;
  mentions: Id[];
  createdAt: IsoDateTime;
}

export interface Announcement {
  id: Id;
  authorId: Id;
  text: string;
  pinned: boolean;
  createdAt: IsoDateTime;
}

export interface Absence {
  id: Id;
  userId: Id;
  from: IsoDate;
  to: IsoDate;
  reason: string;
  /** Horas que reduce del mínimo del periodo. */
  reducedHours: number;
}

export type NotificationType =
  | "daily_pending"
  | "hours_missing"
  | "expense_vote"
  | "expense_result"
  | "mention"
  | "renewal"
  | "meeting";
export interface Notification {
  id: Id;
  userId: Id;
  type: NotificationType;
  payload: Record<string, string>;
  read: boolean;
  createdAt: IsoDateTime;
}

export type AuditAction = "create" | "update" | "void";
export interface AuditLogEntry {
  id: Id;
  table: string;
  recordId: Id;
  action: AuditAction;
  before: unknown;
  after: unknown;
  userId: Id;
  createdAt: IsoDateTime;
}

export type MeetingStatus = "polling" | "confirmed" | "held" | "cancelled";
export interface Meeting {
  id: Id;
  /** Lunes de la semana (Lima). */
  week: IsoDate;
  status: MeetingStatus;
  confirmedSlotId: Id | null;
  meetLink: string | null;
  attendeeIds: Id[];
}

export interface MeetingSlot {
  id: Id;
  meetingId: Id;
  startsAt: IsoDateTime;
}

export interface SlotVote {
  slotId: Id;
  userId: Id;
  available: boolean;
}

/** Resultado de la vista `member_monthly_summary`. */
export interface MemberMonthlySummary {
  userId: Id;
  /** Mes en formato `YYYY-MM` (Lima). */
  month: string;
  hours: number;
  minimumHours: number;
  /** Horas / mínimo (1 = justo en el mínimo). */
  compliance: number;
  meetsMinimum: boolean;
}

/** Resultado de la vista `member_points`. */
export interface MemberPoints {
  userId: Id;
  hourPoints: number;
  moneyPoints: number;
  totalPoints: number;
  /** Fracción 0–1 sobre los puntos totales. */
  participation: number;
}

export interface HoursDraft {
  id: Id;
  userId: Id;
  taskId: Id | null;
  title: string;
  projectId: Id | null;
  hours: number;
  measured: boolean;
  date: IsoDate;
  entryIds: Id[];
  submittedAt?: string;
}
