import type {
  AuditEntity,
  AuditEventType,
  AuditLogEntry,
} from "@vexa/domain/audit";
import type { DailyRecord } from "@vexa/domain/daily";
import type {
  ChatAttachment,
  ChatEvent,
  ChatMemberStatus,
  ChatMessage,
  ChatSettings,
  ChatThread,
} from "@vexa/domain/chat";
import type {
  Area,
  Role,
  HoursDraft,
  HoursEvidence,
  ProjectLabel,
  Announcement,
  Comment,
  CommentEntity,
  Expense,
  ExpenseVote,
  Id,
  IsoDate,
  IsoDateTime,
  MemberMonthlySummary,
  MemberPoints,
  Meeting,
  MeetingSlot,
  MfaChallenge,
  MfaEnrollment,
  AuthSession,
  MfaFactor,
  Notification,
  NotificationPreferences,
  Profile,
  ProfileDetailsInput,
  Project,
  RecurringExpense,
  Settings,
  SlotVote,
  Sprint,
  SprintCloseReport,
  Task,
  TaskStatus,
  TimeEntry,
} from "@vexa/domain/types";
/**
 * Interfaces de la capa de datos. Todo es asíncrono, como si hablara con una API.
 * El usuario que actúa lo resuelve cada implementación (sesión simulada o Supabase Auth),
 * por eso los métodos no reciben "quién soy". Los permisos se aplican en el servicio.
 */
export interface AuthService {
  /** Socios que pueden iniciar sesión (pantalla de login simulada). */
  listLoginProfiles(): Promise<Profile[]>;
  getSession(): Promise<Profile | null>;
  signIn(userId: Id): Promise<Profile>;
  signOut(): Promise<void>;
  /**
   * Guarda foto y/o banner del usuario con sesión. `undefined` deja el campo igual; `null` lo quita.
   * Los bytes de la imagen nunca entran en la cadena de auditoría. El mock no registra nada;
   * en Supabase solo se guarda la ruta del archivo (evento `member.updated`).
   */
  updateProfileMedia(patch: {
    avatarUrl?: string | null;
    bannerUrl?: string | null;
  }): Promise<Profile>;
  /** Guarda nombre, usuario y bio propios (el correo es de solo lectura). Usuario único. */
  updateProfile(input: ProfileDetailsInput): Promise<Profile>;
  /**
   * Cambia la contraseña tras comprobar la actual. Solo con Supabase; el mock responde
   * "Disponible solo con la conexión a Supabase.".
   */
  updatePassword(input: { currentPassword: string; newPassword: string }): Promise<void>;
  /**
   * Envía el enlace para restablecer la contraseña. NUNCA revela si el correo existe: responde igual
   * para cualquier correo bien escrito; solo falla por correo mal formado o límite de envíos.
   * Opcional: el mock no la implementa y avisa que requiere Supabase.
   */
  requestPasswordReset?(email: string): Promise<void>;
  /**
   * Fija la contraseña nueva desde la sesión de recuperación (enlace del correo) y cierra todas las
   * sesiones. Opcional, solo con Supabase.
   */
  completePasswordReset?(newPassword: string): Promise<void>;
  /** Cierra la sesión en los demás dispositivos y conserva esta. Solo con Supabase. */
  signOutOthers(): Promise<void>;
  /** Sesiones activas de la persona (sin IP), la actual primero. Solo con Supabase. */
  listSessions(): Promise<AuthSession[]>;
  /** Cierra una sesión propia que no sea la actual. Solo con Supabase. */
  revokeSession(id: Id): Promise<void>;
  /**
   * Segundo paso con TOTP (solo con Supabase). Hoy se exige únicamente en el cliente: el RLS no
   * pide aal2, así que un token aal1 aún puede llamar a la API REST (endurecer con aal2 queda
   * como tarea aparte).
   */
  listMfaFactors(): Promise<MfaFactor[]>;
  enrollMfa(): Promise<MfaEnrollment>;
  verifyMfaEnrollment(factorId: Id, code: string): Promise<void>;
  disableMfa(factorId: Id): Promise<void>;
  /** ¿La sesión necesita el segundo paso? Úsalo tras entrar con contraseña y al restaurar la sesión. */
  getMfaChallenge(): Promise<MfaChallenge>;
  /** Completa el segundo paso con el código de la app y devuelve el perfil con sesión aal2. */
  verifyMfaLogin(factorId: Id, code: string): Promise<Profile>;
}

export interface SettingsService {
  get(): Promise<Settings>;
}

/** Invitación de un colaborador. Los socios entran tras una votación y un administrador los promueve después. */
export interface InviteMemberInput {
  email: string;
  name: string;
  role?: "collaborator";
  area?: Area;
  weeklyHours?: number;
  /** Proyectos a los que se une al aceptar (membresía explícita). */
  projectIds?: Id[];
}

export interface MemberService {
  list(): Promise<Profile[]>;
  get(id: Id): Promise<Profile | null>;
  /**
   * Solo administrador. Envía la invitación por correo (Supabase) o crea un colaborador pendiente sin
   * enviar nada (mock). Devuelve el perfil; si ya existe una cuenta con ese correo, falla con un aviso genérico.
   */
  invite?(input: InviteMemberInput): Promise<Profile>;
  /** Solo administrador. No sobre sí mismo ni dejando al estudio sin administrador activo. */
  setRole?(memberId: Id, role: Role, note?: string): Promise<Profile>;
  /** Solo administrador. Desactivar exige motivo y cierra las sesiones de la persona; reactivar las deja entrar de nuevo. */
  setActive?(memberId: Id, active: boolean, reason?: string): Promise<Profile>;
}

export interface ProjectService {
  listLabels(projectId: Id): Promise<ProjectLabel[]>;
  createLabel(
    projectId: Id,
    input: { name: string; color: string },
  ): Promise<ProjectLabel>;
  updateLabel(
    id: Id,
    input: { name: string; color: string },
  ): Promise<ProjectLabel>;
  create(input: Omit<Project, "id">): Promise<Project>;
  update(id: Id, patch: Partial<Omit<Project, "id">>): Promise<Project>;
  list(): Promise<Project[]>;
  get(id: Id): Promise<Project | null>;
}

export interface SprintService {
  listByProject(projectId: Id): Promise<Sprint[]>;
  getActive(projectId: Id): Promise<Sprint | null>;
  create(input: Omit<Sprint, "id" | "status">): Promise<Sprint>;
  /**
   * Cierra el sprint (solo admin, sprint activo) en una sola operación: valida en bloque las horas
   * elegidas y las bloquea, guarda el reporte de entrega y manda al backlog lo que no se terminó.
   * Todo o nada: si una hora no es elegible no se cambia nada.
   */
  close(sprintId: Id, validatedEntryIds: Id[]): Promise<Sprint>;
  /**
   * Entregado vs comprometido por persona y horas pendientes de validar. En un sprint cerrado
   * devuelve el reporte guardado al cerrar.
   */
  getCloseReport?(sprintId: Id): Promise<SprintCloseReport>;
}

export interface TaskFilter {
  projectId?: Id;
  sprintId?: Id;
  assigneeId?: Id;
}

export type NewTaskInput = Omit<Task, "id" | "status"> & {
  status?: TaskStatus;
};
export interface TaskService {
  list(filter?: TaskFilter): Promise<Task[]>;
  create(input: NewTaskInput): Promise<Task>;
  update(id: Id, patch: Partial<Omit<Task, "id">>): Promise<Task>;
  move(id: Id, status: TaskStatus): Promise<Task>;
}

export interface TimeEntryFilter {
  userId?: Id;
  taskId?: Id;
  /** Rango de inicio de la entrada. */
  from?: IsoDateTime;
  to?: IsoDateTime;
}

/** Person to tag on an entry; `sharePercent` is an integer 1-100 (default 100). */
export interface HoursParticipantInput {
  userId: Id;
  sharePercent?: number;
}

/** File to attach as evidence. `data` is a data URL (`data:<mime>;base64,...`), like chat attachments. */
export type HoursEvidenceFile = Pick<ChatAttachment, "name" | "type" | "data">;

export interface ManualEntryInput {
  taskId: Id | null;
  projectId?: Id | null;
  description?: string;
  evidenceUrl?: string | null;
  startTime?: string;
  date: IsoDate;
  hours: number;
  /** People who helped; the owner always keeps 100 %. */
  participants?: HoursParticipantInput[];
}

export interface TimeService {
  pause(): Promise<TimeEntry | null>;
  resume(): Promise<TimeEntry | null>;
  listDrafts(): Promise<HoursDraft[]>;
  submitDrafts(input: {
    items: { id: Id; hours: number }[];
    date: IsoDate;
    description?: string;
    /** People who helped; the owner always keeps 100 %. */
    participants?: HoursParticipantInput[];
  }): Promise<TimeEntry>;
  listEntries(filter?: TimeEntryFilter): Promise<TimeEntry[]>;
  /** Entrada con temporizador abierto del usuario actual, si existe. */
  getRunning(): Promise<TimeEntry | null>;
  /** Inicia un temporizador; detiene el que estuviera abierto. */
  start(
    taskId: Id | null,
    activity?: Pick<
      ManualEntryInput,
      "description" | "projectId" | "evidenceUrl"
    >,
  ): Promise<TimeEntry>;
  stop(): Promise<TimeEntry | null>;
  addManual(input: ManualEntryInput): Promise<TimeEntry>;
  update(
    id: Id,
    patch: Partial<
      Pick<
        TimeEntry,
        | "taskId"
        | "hours"
        | "startedAt"
        | "description"
        | "projectId"
        | "evidenceUrl"
      >
    >,
  ): Promise<TimeEntry>;
  /** Nadie borra: se anula con motivo. */
  void(id: Id, reason: string): Promise<TimeEntry>;
  /** Aprueba registros finalizados de otras personas; solo socios/admin. */
  validate(entryIds: Id[]): Promise<TimeEntry[]>;
  requestClarification(id: Id, note: string): Promise<TimeEntry>;
  /**
   * Leaves exactly this set of tagged people (an empty list removes them all). Only the owner, while the
   * entry is editable; a validated entry goes back to pending. Reviewers cannot approve entries where
   * they are tagged.
   */
  setParticipants(
    entryId: Id,
    participants: HoursParticipantInput[],
  ): Promise<TimeEntry>;
  /** Attaches a file (max 5 per entry, 10 MiB in Supabase / 3 MiB in the mock). Owner only, while editable. */
  addEvidence(entryId: Id, file: HoursEvidenceFile): Promise<HoursEvidence>;
  /** Removes a file of an editable entry (owner only). */
  removeEvidence(evidenceId: Id): Promise<void>;
  /** Temporary URL (signed in Supabase, data URL in the mock) to open a file; fails if it was purged. */
  getEvidenceUrl(evidenceId: Id): Promise<string>;
  /**
   * Best-effort sweep: removes the files already due (7 days after validation, or at once if the entry
   * was voided) and records it. Never throws; resolves with how many files were removed.
   */
  purgeExpiredEvidence(): Promise<number>;
}

export interface NewExpenseInput {
  amount: number;
  currency: Expense["currency"];
  concept: string;
  category: Expense["category"];
  /** Comprobante como data URL (jpeg, png, webp o pdf); `null` si no hay. */
  receiptUrl: string | null;
  beforeSigning?: boolean;
}

export interface ExpenseService {
  list(): Promise<Expense[]>;
  create(input: NewExpenseInput): Promise<Expense>;
  listVotes(expenseId: Id): Promise<ExpenseVote[]>;
  vote(expenseId: Id, inFavor: boolean): Promise<Expense>;
  void(id: Id, reason: string): Promise<Expense>;
  listRecurring(): Promise<RecurringExpense[]>;
  /** Dirección para mostrar el comprobante (data URL en el mock, URL firmada en Supabase). */
  getReceiptUrl(expenseId: Id): Promise<string | null>;
}

export interface DashboardService {
  /** Resumen de cumplimiento de todos los socios en un mes (`YYYY-MM`, Lima). */
  getMonthlySummary(month: string): Promise<MemberMonthlySummary[]>;
  getPoints(): Promise<MemberPoints[]>;
}

export interface NewDailyInput {
  done: string;
  willDo: string;
  blockers: string;
}

export interface DailyService {
  /**
   * Dailies compartidos, del más reciente al más antiguo. Admin y socios ven todos; un colaborador
   * solo los suyos.
   */
  list(filter?: { userId?: Id; date?: IsoDate }): Promise<DailyRecord[]>;
  /** Envía el daily de hoy (Lima) de la persona con sesión; reenviar el mismo día lo corrige. */
  submit(input: NewDailyInput): Promise<DailyRecord>;
  /** Tareas trabajadas desde el último daily, para autocompletar "qué hice". */
  suggestDone(): Promise<string>;
}

export interface CommentService {
  /** Hilo de una entidad, del más antiguo al más nuevo. Solo lo que la persona puede leer de esa entidad. */
  list(entity: CommentEntity, entityId: Id): Promise<Comment[]>;
  /**
   * Comenta como la persona con sesión (texto de 1 a 2000 caracteres). `mentions` son los ids que la UI
   * resolvió desde `@usuario`; la base descarta a quien no puede leer la entidad y avisa a los demás.
   * Los comentarios no se editan ni se borran.
   */
  add(input: {
    entity: CommentEntity;
    entityId: Id;
    text: string;
    mentions?: Id[];
  }): Promise<Comment>;
}

export interface AnnouncementService {
  /** Fijados primero y luego los más nuevos. Los leen admin y socios. */
  list(): Promise<Announcement[]>;
  /** Solo admin publica (texto de 1 a 1000 caracteres). */
  create(text: string, options?: { pinned?: boolean }): Promise<Announcement>;
  /** Solo admin fija o desfija; los anuncios no se borran. */
  setPinned(id: Id, pinned: boolean): Promise<Announcement>;
}

export interface MeetingDetail {
  meeting: Meeting;
  slots: MeetingSlot[];
  votes: SlotVote[];
}

export interface MeetingService {
  /** Convocatoria de la semana en curso, si existe. */
  getCurrent(): Promise<MeetingDetail | null>;
  /** Solo el product owner. */
  propose(slotStarts: IsoDateTime[]): Promise<MeetingDetail>;
  vote(slotId: Id, available: boolean): Promise<MeetingDetail>;
  /** Solo el product owner. */
  confirm(meetingId: Id, slotId: Id, meetLink: string): Promise<MeetingDetail>;
  /** Solo el product owner. */
  markAttendance(meetingId: Id, attendeeIds: Id[]): Promise<MeetingDetail>;
}

export interface NotificationService {
  list(): Promise<Notification[]>;
  markRead(id: Id): Promise<void>;
  markAllRead(): Promise<void>;
  /** Preferencias propias; sin fila guardada, todo activado. */
  getPreferences(): Promise<NotificationPreferences>;
  /** Cambia solo las preferencias indicadas y devuelve el resultado. */
  updatePreferences(patch: Partial<NotificationPreferences>): Promise<NotificationPreferences>;
}

export interface AuditFilter {
  actorId?: Id;
  projectId?: Id;
  entityTable?: AuditEntity["table"];
  entityId?: Id;
  eventTypes?: AuditEventType[];
  /** Rango de `occurredAt`, ambos extremos incluidos. */
  from?: IsoDateTime;
  to?: IsoDateTime;
}

export interface AuditPage {
  items: AuditLogEntry[];
  /** `seq` desde el cual pedir la siguiente página; `null` si ya no hay más. */
  nextCursor: number | null;
}

/**
 * Registro de actividad, solo lectura: las escrituras son internas (mock) o por trigger (Supabase).
 * Visibilidad: admin ve todo; socio ve sus proyectos y sus acciones; colaborador solo las suyas.
 */
export interface AuditService {
  /** Más recientes primero, paginado por `seq`: con `cursor` devuelve entradas con `seq` menor. */
  list(
    filter?: AuditFilter,
    cursor?: number | null,
    limit?: number,
  ): Promise<AuditPage>;
  /** Historial de un registro, más reciente primero. */
  timeline(entity: Pick<AuditEntity, "table" | "id">): Promise<AuditLogEntry[]>;
}

/**
 * Chat: conversaciones, mensajes, reacciones, lecturas, ajustes, estado y presencia.
 * Las reglas (acceso, límites, quién edita o anula) viven en cada implementación y fallan con
 * mensajes en español. Las marcas de tiempo son milisegundos; los adaptadores convierten.
 */
export interface ChatService {
  /** Conversaciones a las que la persona puede entrar, con integrantes, lecturas y mensajes recientes. */
  listThreads(): Promise<ChatThread[]>;
  /** Hasta `limit` mensajes anteriores a `beforeSentAt`, del más antiguo al más reciente. */
  loadOlder(
    threadId: Id,
    beforeSentAt: number,
    limit?: number,
  ): Promise<ChatMessage[]>;
  /** Conversación directa con otra persona; una sola por pareja (la segunda llamada devuelve la misma). */
  directThread(otherId: Id): Promise<Id>;
  /** Crea o edita un grupo (con `id`). Solo administradores; el creador siempre es integrante. */
  saveGroup(input: {
    id?: Id;
    name: string;
    description: string;
    members: Id[];
  }): Promise<Id>;
  /** Elimina un grupo y sus mensajes. Solo administradores. */
  deleteGroup(id: Id): Promise<void>;
  /** Envía texto y/o adjunto; actualiza la lectura de quien envía. */
  sendMessage(
    threadId: Id,
    input: { text: string; attachment?: ChatAttachment; replyTo?: Id },
  ): Promise<ChatMessage>;
  /** Solo el autor edita; el texto no puede quedar vacío. */
  editMessage(threadId: Id, messageId: Id, text: string): Promise<void>;
  /** Anula (borrado suave): el autor, o un administrador en un grupo. */
  deleteMessage(threadId: Id, messageId: Id): Promise<void>;
  /** Un emoji por persona y mensaje: repetirlo lo quita, otro lo reemplaza. */
  reactToMessage(threadId: Id, messageId: Id, emoji: string): Promise<void>;
  /** Reenvía como "Reenviado: <texto>" (solo con texto), copia el adjunto y no conserva la respuesta. */
  forwardMessage(
    fromThreadId: Id,
    messageId: Id,
    toThreadId: Id,
  ): Promise<ChatMessage>;
  /** Marca la conversación como leída hasta ahora (sin efecto si ya está al día). */
  markRead(threadId: Id): Promise<void>;
  /**
   * Marca que mi app abierta recibió los mensajes de la conversación (sin marcarlos como leídos;
   * sin efecto si ya está al día).
   */
  markDelivered(threadId: Id): Promise<void>;
  /**
   * Registra mi descarga del adjunto (hora del servidor; repetirla no cambia nada). Solo integrantes;
   * quien envió el archivo cuenta como descarga implícita.
   */
  markAttachmentDownloaded(messageId: Id): Promise<void>;
  /**
   * Respondo "¿debe quedarse este archivo en el chat?" (`keep`: conservar o liberar espacio), una sola
   * vez y cuando todos descargaron. Si con mi respuesta todos liberaron, el archivo se retira
   * (mejor esfuerzo: un fallo del almacenamiento no falla la respuesta).
   */
  answerAttachmentKeep(messageId: Id, keep: boolean): Promise<void>;
  /**
   * Retira el archivo de un adjunto que todos liberaron y aún no se retiró (reintento; sin efecto en
   * cualquier otro caso). El mensaje se conserva con un marcador de texto.
   */
  purgeReleasedAttachment(messageId: Id): Promise<void>;
  getSettings(): Promise<ChatSettings>;
  /** Un parche conserva el resto de ajustes; el estado se recorta a 80 caracteres. */
  updateSettings(patch: Partial<ChatSettings>): Promise<ChatSettings>;
  /** Estado público de cada integrante del estudio (estado, presencia activada, proyecto fijado). */
  listMemberStatus(): Promise<Record<Id, ChatMemberStatus>>;
  /** Imagen de fondo propia como data URL, o `null`. */
  getWallpaperImage(): Promise<string | null>;
  /** Guarda la imagen de fondo; falla si no es una imagen válida o es demasiado pesada. */
  saveWallpaperImage(dataUrl: string): Promise<void>;
  removeWallpaperImage(): Promise<void>;
  /** Mensajes con adjunto o enlace de toda la conversación, para la vista de archivos compartidos. */
  listSharedMessages(threadId: Id): Promise<ChatMessage[]>;
  /** Avisa de cambios para invalidar caches; devuelve la función para cancelar. */
  subscribe(listener: (event: ChatEvent) => void): () => void;
  /** Activa o desactiva la presencia propia (pestaña visible y presencia permitida). */
  trackPresence(enabled: boolean): void;
  /** Personas en línea (`userId -> última señal en ms`); devuelve la función para cancelar. */
  subscribePresence(callback: (online: Record<Id, number>) => void): () => void;
}

export interface Services {
  auth: AuthService;
  settings: SettingsService;
  members: MemberService;
  projects: ProjectService;
  sprints: SprintService;
  tasks: TaskService;
  time: TimeService;
  expenses: ExpenseService;
  dashboard: DashboardService;
  daily: DailyService;
  comments: CommentService;
  announcements: AnnouncementService;
  meetings: MeetingService;
  notifications: NotificationService;
  audit: AuditService;
  chat: ChatService;
}
