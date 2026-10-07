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
  /** Foto de perfil (data URL ya recortada y comprimida). */
  avatarUrl?: string | null;
  /** Banner del perfil (data URL ya recortada y comprimida). */
  bannerUrl?: string | null;
  /** Fecha de registro en la plataforma. */
  joinedAt?: IsoDateTime;
  /** Usuario único (minúsculas, 3–30: letras, números, punto o guion bajo); `null` hasta elegirlo. */
  username?: string | null;
  /** "Sobre mí", hasta 280 caracteres. */
  bio?: string | null;
  /** Correo de la cuenta (solo lectura); lo entrega la sesión de Supabase, no la tabla de perfiles. */
  email?: string | null;
  /** Invitación enviada y aún sin aceptar (solo el mock lo marca; en Supabase la persona entra al fijar su contraseña). */
  pendingInvite?: boolean;
}

/** Datos personales que la propia persona puede editar. */
export interface ProfileDetailsInput {
  name: string;
  username: string | null;
  bio: string | null;
}

/** Factor TOTP de segundo paso. */
export interface MfaFactor {
  id: Id;
  friendlyName: string | null;
  /** `unverified` es un alta que no se terminó de confirmar. */
  status: "verified" | "unverified";
  createdAt: IsoDateTime;
}

/** Sesión activa de la persona: dispositivo, última actividad y si es la de este navegador. Sin IP. */
export interface AuthSession {
  id: Id;
  createdAt: IsoDateTime;
  /** Última actividad. */
  lastActiveAt: IsoDateTime;
  userAgent: string | null;
  aal: "aal1" | "aal2";
  isCurrent: boolean;
}

/** Alta de un factor TOTP: la persona escanea el QR (o escribe el secreto) y confirma con un código. */
export interface MfaEnrollment {
  factorId: Id;
  /** SVG del código QR listo para mostrar. */
  qrCodeSvg: string;
  /** Secreto en texto para quien no puede escanear; nunca se registra ni se guarda. */
  secret: string;
  /** URI `otpauth://`. */
  uri: string;
}

/** Si la sesión actual aún necesita el segundo paso (aal1 con factor verificado → aal2). */
export interface MfaChallenge {
  required: boolean;
  factorId?: Id;
}

/** Preferencias de notificación por persona; sin fila guardada, todo está activado. */
export interface NotificationPreferences {
  taskAssigned: boolean;
  /** Guardada; aún sin efecto (no hay recordatorios por reloj). */
  hoursReminder: boolean;
  /** Guardada; aún sin efecto (no hay resumen por reloj). */
  weeklySummary: boolean;
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
/** Entrega de una persona en un sprint: comprometido vs entregado y horas estimadas vs registradas. */
export interface SprintPartnerReport {
  /** `null` agrupa las tareas sin responsable. */
  userId: Id | null;
  committed: number;
  delivered: number;
  estimatedHours: number;
  loggedHours: number;
}

export interface Sprint {
  id: Id;
  projectId: Id;
  startDate: IsoDate;
  endDate: IsoDate;
  goal: string;
  status: SprintStatus;
  closedAt?: IsoDateTime | null;
  closedById?: Id | null;
  /** Reporte de entrega guardado al cerrar (lo leerá la regla de "2 sprints sin entregar"). */
  deliveryReport?: SprintPartnerReport[] | null;
  /** Horas que quedaron sin validar al cerrar (siguen pendientes por la vía de aclaración). */
  closePendingEntryIds?: Id[] | null;
}

/** Horas pendientes de un sprint que quien cierra puede validar en bloque. */
export interface SprintCloseEntry {
  id: Id;
  userId: Id;
  description: string;
  startedAt: IsoDateTime;
  /** Horas del registro que caen en tareas del sprint. */
  hoursInSprint: number;
  participantIds: Id[];
  clarificationRequested: boolean;
}

export interface SprintCloseReport {
  sprint: Sprint;
  partners: SprintPartnerReport[];
  /** Horas aún pendientes de validar (al cerrar, las que no se validaron). */
  pendingEntries: SprintCloseEntry[];
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

/** Person who helped on an entry; `sharePercent` (1-100) of its hours is credited to them. */
export interface HoursParticipant {
  userId: Id;
  sharePercent: number;
}

/** File attached to an entry. The bytes live in Storage (or in the mock); this is the metadata. */
export interface HoursEvidence {
  id: Id;
  name: string;
  mime: string;
  size: number;
  createdAt: IsoDateTime;
  /** When the file becomes eligible for deletion; `null`/absent while the entry is not validated. */
  purgeAt?: IsoDateTime | null;
  /** The file was already deleted (the metadata stays as a text marker). */
  purged: boolean;
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
  /** Sprint cuyo cierre validó y bloqueó este registro (ya no se edita). */
  lockedBySprintId?: Id | null;
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
  /** People tagged by the owner. Always present when it comes from a service (empty = none). */
  participants?: HoursParticipant[];
  /** Attached files. Always present when it comes from a service (empty = none). */
  evidence?: HoursEvidence[];
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
  | "project_added"
  | "task_assigned"
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

export type MeetingStatus = "polling" | "confirmed" | "held" | "cancelled";
export interface Meeting {
  id: Id;
  /** Lunes de la semana (Lima). */
  week: IsoDate;
  status: MeetingStatus;
  confirmedSlotId: Id | null;
  meetLink: string | null;
  attendeeIds: Id[];
  /** Cuándo se convocó; de aquí sale el aviso derivado "sin responder hace más de 24 h". */
  createdAt: IsoDateTime;
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
