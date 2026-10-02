import type {
  Announcement,
  Comment,
  CommentEntity,
  DailyUpdate,
  Expense,
  ExpenseVote,
  Id,
  IsoDate,
  IsoDateTime,
  MemberMonthlySummary,
  MemberPoints,
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
  TaskStatus,
  TimeEntry,
} from '@/domain/types'

/**
 * Interfaces de la capa de datos. Todo es asíncrono, como si hablara con una API.
 * El usuario que actúa lo resuelve cada implementación (sesión simulada o Supabase Auth),
 * por eso los métodos no reciben "quién soy". Los permisos se aplican en el servicio.
 */

export interface AuthService {
  /** Socios que pueden iniciar sesión (pantalla de login simulada). */
  listLoginProfiles(): Promise<Profile[]>
  getSession(): Promise<Profile | null>
  signIn(userId: Id): Promise<Profile>
  signOut(): Promise<void>
}

export interface SettingsService {
  get(): Promise<Settings>
}

export interface MemberService {
  list(): Promise<Profile[]>
  get(id: Id): Promise<Profile | null>
}

export interface ProjectService {
  list(): Promise<Project[]>
  get(id: Id): Promise<Project | null>
}

export interface SprintService {
  listByProject(projectId: Id): Promise<Sprint[]>
  getActive(projectId: Id): Promise<Sprint | null>
  create(input: Omit<Sprint, 'id' | 'status'>): Promise<Sprint>
  /** Cierra el sprint: valida en bloque las horas y las bloquea. */
  close(sprintId: Id, validatedEntryIds: Id[]): Promise<Sprint>
}

export interface TaskFilter {
  projectId?: Id
  sprintId?: Id
  assigneeId?: Id
}

export type NewTaskInput = Omit<Task, 'id' | 'status'> & { status?: TaskStatus }

export interface TaskService {
  list(filter?: TaskFilter): Promise<Task[]>
  create(input: NewTaskInput): Promise<Task>
  update(id: Id, patch: Partial<Omit<Task, 'id'>>): Promise<Task>
  move(id: Id, status: TaskStatus): Promise<Task>
}

export interface TimeEntryFilter {
  userId?: Id
  taskId?: Id
  /** Rango de inicio de la entrada. */
  from?: IsoDateTime
  to?: IsoDateTime
}

export interface ManualEntryInput {
  taskId: Id | null
  projectId?: Id | null
  description?: string
  evidenceUrl?: string | null
  startTime?: string
  date: IsoDate
  hours: number
}

export interface TimeService {
  listEntries(filter?: TimeEntryFilter): Promise<TimeEntry[]>
  /** Entrada con temporizador abierto del usuario actual, si existe. */
  getRunning(): Promise<TimeEntry | null>
  /** Inicia un temporizador; detiene el que estuviera abierto. */
  start(taskId: Id | null, activity?: Pick<ManualEntryInput, 'description' | 'projectId' | 'evidenceUrl'>): Promise<TimeEntry>
  stop(): Promise<TimeEntry | null>
  addManual(input: ManualEntryInput): Promise<TimeEntry>
  update(id: Id, patch: Partial<Pick<TimeEntry, 'taskId' | 'hours' | 'startedAt' | 'description' | 'projectId' | 'evidenceUrl'>>): Promise<TimeEntry>
  /** Nadie borra: se anula con motivo. */
  void(id: Id, reason: string): Promise<TimeEntry>
  /** Aprueba registros finalizados de otras personas; solo socios/admin. */
  validate(entryIds: Id[]): Promise<TimeEntry[]>
  requestClarification(id: Id, note: string): Promise<TimeEntry>
}

export interface NewExpenseInput {
  amount: number
  currency: Expense['currency']
  concept: string
  category: Expense['category']
  receiptUrl: string | null
  beforeSigning?: boolean
}

export interface ExpenseService {
  list(): Promise<Expense[]>
  create(input: NewExpenseInput): Promise<Expense>
  listVotes(expenseId: Id): Promise<ExpenseVote[]>
  vote(expenseId: Id, inFavor: boolean): Promise<Expense>
  void(id: Id, reason: string): Promise<Expense>
  listRecurring(): Promise<RecurringExpense[]>
}

export interface DashboardService {
  /** Resumen de cumplimiento de todos los socios en un mes (`YYYY-MM`, Lima). */
  getMonthlySummary(month: string): Promise<MemberMonthlySummary[]>
  getPoints(): Promise<MemberPoints[]>
}

export interface NewDailyInput {
  done: string
  willDo: string
  blockers: string
}

export interface DailyService {
  list(filter?: { userId?: Id; date?: IsoDate }): Promise<DailyUpdate[]>
  submit(input: NewDailyInput): Promise<DailyUpdate>
  /** Tareas trabajadas desde el último daily, para autocompletar "qué hice". */
  suggestDone(): Promise<string>
}

export interface CommentService {
  list(entity: CommentEntity, entityId: Id): Promise<Comment[]>
  add(input: { entity: CommentEntity; entityId: Id; text: string }): Promise<Comment>
}

export interface AnnouncementService {
  list(): Promise<Announcement[]>
  create(text: string): Promise<Announcement>
  setPinned(id: Id, pinned: boolean): Promise<Announcement>
}

export interface MeetingDetail {
  meeting: Meeting
  slots: MeetingSlot[]
  votes: SlotVote[]
}

export interface MeetingService {
  /** Convocatoria de la semana en curso, si existe. */
  getCurrent(): Promise<MeetingDetail | null>
  /** Solo el product owner. */
  propose(slotStarts: IsoDateTime[]): Promise<MeetingDetail>
  vote(slotId: Id, available: boolean): Promise<MeetingDetail>
  /** Solo el product owner. */
  confirm(meetingId: Id, slotId: Id, meetLink: string): Promise<MeetingDetail>
  /** Solo el product owner. */
  markAttendance(meetingId: Id, attendeeIds: Id[]): Promise<MeetingDetail>
}

export interface NotificationService {
  list(): Promise<Notification[]>
  markRead(id: Id): Promise<void>
  markAllRead(): Promise<void>
}

export interface Services {
  auth: AuthService
  settings: SettingsService
  members: MemberService
  projects: ProjectService
  sprints: SprintService
  tasks: TaskService
  time: TimeService
  expenses: ExpenseService
  dashboard: DashboardService
  daily: DailyService
  comments: CommentService
  announcements: AnnouncementService
  meetings: MeetingService
  notifications: NotificationService
}
