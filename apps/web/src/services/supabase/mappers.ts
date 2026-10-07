import type {
  AuditChange,
  AuditClient,
  AuditLogEntry,
  AuditSnapshot,
  ClientPlatform,
} from "@vexa/domain/audit";
import type { DailyRecord } from "@vexa/domain/daily";
import type {
  Announcement,
  Meeting,
  MeetingSlot,
  SlotVote,
  Comment,
  Expense,
  ExpenseVote,
  HoursDraft,
  HoursEvidence,
  IsoDateTime,
  MemberMonthlySummary,
  MemberPoints,
  Notification,
  NotificationPreferences,
  Profile,
  Project,
  ProjectLabel,
  RecurringExpense,
  Settings,
  Sprint,
  SprintPartnerReport,
  Task,
  TimeEntry,
} from "@vexa/domain/types";
import type { Json, Tables, TablesUpdate } from "./database.types";

/**
 * Traducción entre filas de la base (snake_case, tipos de Postgres) y el dominio (camelCase).
 * Son funciones puras: no hablan con la red. Las filas de las RPC con registro compuesto pueden
 * llegar con todos los campos en `null` cuando no hay resultado; ver `mapTimeEntryOrNull`.
 */

/** Selección de tarea con sus etiquetas (relación `task_labels` -> `project_labels`). */
export const TASK_SELECT = "*, task_labels(project_labels(*))";
/** Selección de proyecto con sus miembros. */
export const PROJECT_SELECT = "*, project_members(user_id)";

/** PostgREST devuelve `+00:00` y microsegundos; el dominio guarda ISO UTC con milisegundos. */
export function isoInstant(value: string): IsoDateTime {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`Fecha no válida: ${value}`);
  return new Date(time).toISOString();
}

const iso = (value: string | null): IsoDateTime | null =>
  value === null ? null : isoInstant(value);

/** `21:00:00` -> `21:00`. */
const hourMinute = (value: string) => value.slice(0, 5);

export function mapProfile(row: Tables<"profiles">): Profile {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    area: row.area,
    weeklyHours: row.weekly_hours,
    active: row.active,
    joinedAt: isoInstant(row.created_at),
    username: row.username ?? null,
    bio: row.bio ?? null,
  };
}

export function mapNotificationPreferences(
  row: Pick<
    Tables<"notification_preferences">,
    "task_assigned" | "hours_reminder" | "weekly_summary"
  >,
): NotificationPreferences {
  return {
    taskAssigned: row.task_assigned,
    hoursReminder: row.hours_reminder,
    weeklySummary: row.weekly_summary,
  };
}

export function mapSettings(row: Tables<"settings">): Settings {
  return {
    pointsPerHour: row.points_per_hour,
    pointsPerSol: row.points_per_sol,
    minCompliance: row.min_compliance,
    weeksPerMonth: row.weeks_per_month,
    expenseApprovalLimitPen: row.expense_approval_limit_pen,
    entryEditDays: row.entry_edit_days,
    dailyReminder: {
      time: hourMinute(row.daily_reminder_time),
      weekdays: row.daily_reminder_weekdays,
    },
    weeklyHoursReminder: {
      time: hourMinute(row.weekly_hours_reminder_time),
      weekday: row.weekly_hours_reminder_weekday,
    },
  };
}

export type ProjectRow = Tables<"projects"> & {
  project_members?: { user_id: string }[] | null;
};

export function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    memberIds: (row.project_members ?? []).map((m) => m.user_id),
  };
}

export function mapLabel(row: Tables<"project_labels">): ProjectLabel {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    color: row.color,
  };
}

type SprintRow = Omit<
  Tables<"sprints">,
  "closed_at" | "closed_by" | "close_report"
> &
  Partial<Pick<Tables<"sprints">, "closed_at" | "closed_by" | "close_report">>;

export function mapSprint(row: SprintRow): Sprint {
  return {
    id: row.id,
    projectId: row.project_id,
    startDate: row.start_date,
    endDate: row.end_date,
    goal: row.goal,
    status: row.status,
    // Un sprint sin cerrar no lleva datos de cierre.
    ...(row.closed_at
      ? { closedAt: iso(row.closed_at), closedById: row.closed_by ?? null }
      : {}),
    ...closeReportOf(row.close_report),
  };
}

/** `close_report` = {partners, pendingEntryIds}; vacío mientras el sprint no se cierra. */
function closeReportOf(
  value: Json | null | undefined,
): Pick<Sprint, "deliveryReport" | "closePendingEntryIds"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const report = value as { partners?: Json; pendingEntryIds?: Json };
  return {
    deliveryReport: Array.isArray(report.partners)
      ? (report.partners as unknown as SprintPartnerReport[])
      : [],
    closePendingEntryIds: Array.isArray(report.pendingEntryIds)
      ? (report.pendingEntryIds as string[])
      : [],
  };
}

export type TaskRow = Tables<"tasks"> & {
  task_labels?: { project_labels: Tables<"project_labels"> | null }[] | null;
};

export function mapTask(row: TaskRow): Task {
  return {
    id: row.id,
    sprintId: row.sprint_id,
    projectId: row.project_id,
    hoursPrepared: row.hours_prepared,
    description: row.description ?? undefined,
    labels: (row.task_labels ?? []).flatMap((link) =>
      link.project_labels ? [mapLabel(link.project_labels)] : [],
    ),
    title: row.title,
    status: row.status,
    assigneeId: row.assignee_id,
    estimateHours: row.estimate_hours,
    link: row.link,
  };
}

/** Columnas de `tasks` que cambia un parche de dominio; solo incluye lo presente. */
export function taskPatchToColumns(
  patch: Partial<Omit<Task, "id">>,
): TablesUpdate<"tasks"> {
  const columns: TablesUpdate<"tasks"> = {};
  if (patch.title !== undefined) columns.title = patch.title.trim();
  if (patch.description !== undefined) columns.description = patch.description;
  if (patch.status !== undefined) columns.status = patch.status;
  if (patch.assigneeId !== undefined) columns.assignee_id = patch.assigneeId;
  if (patch.estimateHours !== undefined)
    columns.estimate_hours = patch.estimateHours;
  if (patch.link !== undefined) columns.link = patch.link;
  if (patch.sprintId !== undefined) columns.sprint_id = patch.sprintId;
  if (patch.projectId !== undefined) columns.project_id = patch.projectId;
  return columns;
}

function jsonArray<T>(value: Json | null): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

/** Selección de un registro de horas con sus etiquetas y su evidencia (relaciones por `entry_id`). */
export const TIME_ENTRY_SELECT =
  "*, time_entry_participants(*), time_entry_evidence(*)";

export type TimeEntryRow = Omit<Tables<"time_entries">, "locked_by_sprint"> &
  Partial<Pick<Tables<"time_entries">, "locked_by_sprint">> & {
  time_entry_participants?: Tables<"time_entry_participants">[] | null;
  time_entry_evidence?: Tables<"time_entry_evidence">[] | null;
};

export function mapEvidence(row: Tables<"time_entry_evidence">): HoursEvidence {
  return {
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    createdAt: isoInstant(row.created_at),
    purgeAt: iso(row.purge_after),
    purged: row.purged_at !== null,
  };
}

export function mapTimeEntry(row: TimeEntryRow): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    startedAt: isoInstant(row.started_at),
    endedAt: iso(row.ended_at),
    hours: row.hours,
    paid: row.paid,
    validated: row.validated,
    validatedAt: iso(row.validated_at),
    createdAt: isoInstant(row.created_at),
    voidedAt: iso(row.voided_at),
    voidReason: row.void_reason,
    ...(row.locked_by_sprint ? { lockedBySprintId: row.locked_by_sprint } : {}),
    projectId: row.project_id,
    description: row.description ?? undefined,
    evidenceUrl: row.evidence_url,
    source: (row.source as TimeEntry["source"]) ?? undefined,
    validatedBy: row.validated_by,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    draft: row.draft,
    timerState: (row.timer_state as TimeEntry["timerState"]) ?? undefined,
    elapsedMs: row.elapsed_ms,
    segmentStartedAt: iso(row.segment_started_at),
    segments: jsonArray<{ start: string; end: string }>(row.segments),
    allocations: jsonArray<NonNullable<TimeEntry["allocations"]>[number]>(
      row.allocations,
    ),
    participants: [...(row.time_entry_participants ?? [])]
      .sort((a, b) => a.user_id.localeCompare(b.user_id))
      .map((p) => ({ userId: p.user_id, sharePercent: p.share_percent })),
    evidence: [...(row.time_entry_evidence ?? [])]
      .sort(
        (a, b) =>
          Date.parse(a.created_at) - Date.parse(b.created_at) ||
          a.id.localeCompare(b.id),
      )
      .map(mapEvidence),
  };
}

/** Una RPC con registro compuesto puede devolver `null` o una fila con todo en `null`. */
export function mapTimeEntryOrNull(
  row: TimeEntryRow | null,
): TimeEntry | null {
  return row && row.id ? mapTimeEntry(row) : null;
}

export function mapDraft(row: Tables<"hours_drafts">): HoursDraft {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id,
    title: row.title,
    projectId: row.project_id,
    hours: row.hours,
    measured: row.measured,
    date: row.draft_date,
    entryIds: row.entry_ids,
    submittedAt: row.submitted_at ? isoInstant(row.submitted_at) : undefined,
  };
}

export function mapExpense(row: Tables<"expenses">): Expense {
  return {
    id: row.id,
    paidBy: row.paid_by,
    amount: row.amount,
    currency: row.currency,
    concept: row.concept,
    category: row.category,
    receiptUrl: row.receipt_url,
    status: row.status,
    reimbursed: row.reimbursed,
    beforeSigning: row.before_signing,
    createdAt: isoInstant(row.created_at),
    voidReason: row.void_reason,
  };
}

export function mapVote(row: Tables<"expense_votes">): ExpenseVote {
  return {
    expenseId: row.expense_id,
    userId: row.user_id,
    inFavor: row.in_favor,
  };
}

export function mapRecurring(
  row: Tables<"recurring_expenses">,
): RecurringExpense {
  return {
    id: row.id,
    concept: row.concept,
    amount: row.amount,
    currency: row.currency,
    nextDate: row.next_date,
    periodicity: row.periodicity,
    beforeSigning: row.before_signing,
  };
}

export function mapMonthlySummary(row: {
  user_id: string;
  month: string;
  hours: number;
  minimum_hours: number;
  compliance: number;
  meets_minimum: boolean;
}): MemberMonthlySummary {
  return {
    userId: row.user_id,
    month: row.month,
    hours: row.hours,
    minimumHours: row.minimum_hours,
    compliance: row.compliance,
    meetsMinimum: row.meets_minimum,
  };
}

export function mapMemberPoints(row: {
  user_id: string | null;
  hour_points: number | null;
  money_points: number | null;
  total_points: number | null;
  participation: number | null;
}): MemberPoints {
  return {
    userId: row.user_id ?? "",
    hourPoints: row.hour_points ?? 0,
    moneyPoints: row.money_points ?? 0,
    totalPoints: row.total_points ?? 0,
    participation: row.participation ?? 0,
  };
}

const PLATFORMS: readonly ClientPlatform[] = ["web", "desktop", "mobile"];

function mapClient(row: Tables<"audit_log">): AuditClient {
  const platform = PLATFORMS.find((p) => p === row.client_platform);
  return { platform: platform ?? "web", appVersion: row.client_version };
}

/**
 * Entrada del registro. `actor_id` es nulo en acciones del sistema (consola, rol de servicio); el
 * dominio exige un actor, así que se identifica como `system` con el rol de menor privilegio.
 */
export function mapAuditEntry(row: Tables<"audit_log">): AuditLogEntry {
  return {
    id: row.id,
    seq: Number(row.seq),
    occurredAt: isoInstant(row.occurred_at),
    clientAt: iso(row.client_at),
    actorId: row.actor_id ?? "system",
    actorRole: row.actor_role ?? "collaborator",
    eventType: row.event_type,
    entity: {
      table: row.entity_table as AuditLogEntry["entity"]["table"],
      id: row.entity_id,
      projectId: row.project_id,
      label: row.entity_label,
    },
    changes: Array.isArray(row.changes) ? (row.changes as unknown as AuditChange[]) : [],
    before: (row.before as AuditSnapshot | null) ?? null,
    after: (row.after as AuditSnapshot | null) ?? null,
    reason: row.reason,
    requestId: row.request_id,
    sessionId: row.session_id ?? "",
    client: mapClient(row),
  };
}

/** La carga de un aviso son textos planos: cualquier otro valor se descarta. */
export function mapNotification(row: Tables<"notifications">): Notification {
  const payload: Record<string, string> = {};
  if (typeof row.payload === "object" && row.payload !== null && !Array.isArray(row.payload))
    for (const [key, value] of Object.entries(row.payload))
      if (typeof value === "string") payload[key] = value;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    payload,
    read: row.read_at !== null,
    createdAt: isoInstant(row.created_at),
  };
}

export function mapDailyUpdate(row: Tables<"daily_updates">): DailyRecord {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    done: row.done,
    willDo: row.will_do,
    blockers: row.blockers,
    updatedAt: isoInstant(row.updated_at),
  };
}

export function mapComment(row: Tables<"comments">): Comment {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    userId: row.user_id,
    text: row.text,
    mentions: row.mentions,
    createdAt: isoInstant(row.created_at),
  };
}

export function mapAnnouncement(row: Tables<"announcements">): Announcement {
  return {
    id: row.id,
    authorId: row.author_id,
    text: row.text,
    pinned: row.pinned,
    createdAt: isoInstant(row.created_at),
  };
}

export function mapMeeting(row: Tables<"meetings">): Meeting {
  return {
    id: row.id,
    week: row.week,
    status: row.status,
    confirmedSlotId: row.confirmed_slot_id,
    meetLink: row.meet_link,
    attendeeIds: row.attendee_ids,
    createdAt: isoInstant(row.created_at),
  };
}

export function mapMeetingSlot(row: Tables<"meeting_slots">): MeetingSlot {
  return { id: row.id, meetingId: row.meeting_id, startsAt: isoInstant(row.starts_at) };
}

export function mapSlotVote(row: Tables<"slot_votes">): SlotVote {
  return { slotId: row.slot_id, userId: row.user_id, available: row.available };
}
