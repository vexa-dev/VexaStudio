import { canEditEntry } from "@/domain/rules";
import type {
  AuditAction,
  Id,
  Profile,
  Sprint,
  Task,
  TimeEntry,
} from "@/domain/types";
import { todayLima } from "@/lib/dates";
import type {
  ProjectService,
  SprintService,
  TaskService,
  TimeService,
} from "../types";
import { getDb, getSessionUserId, save } from "./db";
import { delay, pending } from "./utils";
/**
 * Sprints, tareas y horas. Los permisos se aplican aquí igual que lo hará RLS en la etapa 2:
 * cada persona crea y edita solo sus propios registros de horas, y nadie borra (se anula con motivo).
 */
const HOUR_MS = 60 * 60 * 1000;
function currentUser(): Profile {
  const id = getSessionUserId();
  const user = getDb().profiles.find((p) => p.id === id && p.active);
  if (!user) throw new Error("Inicia sesión para continuar");
  return user;
}

/** Socios y administradores revisan horas de otras personas. */
function currentPartner(): Profile {
  const user = currentUser();
  if (user.role === "collaborator")
    throw new Error("Tu rol no permite esta acción");
  return user;
}

function currentAdmin() {
  const user = currentUser();
  if (user.role !== "admin")
    throw new Error("Solo un administrador puede gestionar proyectos y tareas");
  return user;
}

function projectAccess(id: string) {
  const user = currentUser();
  const project = getDb().projects.find((p) => p.id === id);
  if (
    !project ||
    (user.role !== "admin" && !project.memberIds?.includes(user.id))
  )
    throw new Error("No tienes acceso a este proyecto");
  return project;
}

function ownTask(task: Task, user: Profile) {
  if (task.assigneeId !== user.id)
    throw new Error("Solo puedes trabajar en tus tareas asignadas");
}

function prepareHours(task: Task) {
  if (!task.assigneeId || task.hoursPrepared) return;
  task.hoursPrepared = true;
  const db = getDb();
  const open = db.timeEntries.find(
    (e) =>
      e.userId === task.assigneeId &&
      e.taskId === task.id &&
      !e.endedAt &&
      !e.voidedAt,
  );
  if (open) closeEntry(open, new Date(), task.assigneeId);
  if (!db.hoursDrafts?.some((d) => d.taskId === task.id && !d.submittedAt)) {
    db.hoursDrafts ??= [];
    db.hoursDrafts.push({
      id: newId("draft"),
      userId: task.assigneeId,
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      hours: task.estimateHours ?? 0,
      measured: false,
      date: todayLima(),
      entryIds: [],
    });
  }
}

function validateTask(input: Partial<Task>) {
  if ((input.description?.length ?? 0) > 20000)
    throw new Error("Máximo 20,000 caracteres en la descripción");
  if (
    input.labels?.some(
      (label) =>
        !input.projectId ||
        !getDb().projectLabels?.some(
          (l) => l.id === label.id && l.projectId === input.projectId,
        ),
    )
  )
    throw new Error("Las etiquetas deben pertenecer al proyecto de la tarea");
  const db = getDb();
  if (input.projectId) {
    if (!db.projects.some((p) => p.id === input.projectId))
      throw new Error("El proyecto no existe");
  }
  if (
    input.sprintId &&
    !db.sprints.some(
      (s) => s.id === input.sprintId && s.projectId === input.projectId,
    )
  )
    throw new Error("El sprint no pertenece al proyecto");
  if (
    input.assigneeId &&
    !db.profiles.some((p) => p.id === input.assigneeId && p.active)
  )
    throw new Error("El responsable no existe");
  if (
    input.estimateHours !== undefined &&
    input.estimateHours !== null &&
    (!Number.isFinite(input.estimateHours) || input.estimateHours < 0)
  )
    throw new Error("Estimación no válida");
  if (input.link && !/^https?:\/\/[^\s]+$/i.test(input.link))
    throw new Error("Usa un enlace http o https");
}

function labelFields(
  projectId: Id,
  input: { name: string; color: string },
  exclude?: Id,
) {
  const name = input.name.trim();
  if (!name || name.length > 40)
    throw new Error("Escribe un nombre de hasta 40 caracteres");
  if (!/^#[0-9a-f]{6}$/i.test(input.color))
    throw new Error("Elige un color válido");
  if (
    getDb().projectLabels?.some(
      (l) =>
        l.projectId === projectId &&
        l.id !== exclude &&
        l.name.toLocaleLowerCase("es") === name.toLocaleLowerCase("es"),
    )
  )
    throw new Error("Ya existe una etiqueta con ese nombre");
  return { name, color: input.color.toLowerCase() };
}
export const projects: ProjectService = {
  async listLabels(projectId) {
    currentAdmin();
    projectAccess(projectId);
    return delay(
      getDb().projectLabels?.filter((l) => l.projectId === projectId) ?? [],
    );
  },
  async createLabel(projectId, input) {
    const user = currentAdmin();
    projectAccess(projectId);
    const label = {
      id: newId("label"),
      projectId,
      ...labelFields(projectId, input),
    };
    getDb().projectLabels ??= [];
    getDb().projectLabels!.push(label);
    audit("project_labels", label.id, "create", null, label, user.id);
    save();
    return delay(label);
  },
  async updateLabel(id, input) {
    const user = currentAdmin();
    const label = getDb().projectLabels?.find((l) => l.id === id);
    if (!label) throw new Error("La etiqueta no existe");
    const fields = labelFields(label.projectId, input, id);
    const before = { ...label };
    Object.assign(label, fields);
    for (const task of getDb().tasks)
      task.labels = task.labels?.map((l) => (l.id === id ? { ...label } : l));
    audit("project_labels", id, "update", before, label, user.id);
    save();
    return delay(label);
  },
  async list() {
    const user = currentUser();
    return delay(
      getDb().projects.filter(
        (p) => user.role === "admin" || p.memberIds?.includes(user.id),
      ),
    );
  },
  async get(id) {
    return delay(projectAccess(id));
  },
  async create(input) {
    const user = currentAdmin();
    if (!input.name.trim()) throw new Error("Escribe el nombre del proyecto");
    const members = [...new Set(input.memberIds ?? [])];
    if (
      members.some(
        (id) => !getDb().profiles.some((p) => p.id === id && p.active),
      )
    )
      throw new Error("Miembro no válido");
    const project = {
      ...input,
      memberIds: members,
      name: input.name.trim(),
      id: newId("p"),
    };
    getDb().projects.push(project);
    audit("projects", project.id, "create", null, project, user.id);
    save();
    return delay(project);
  },
  async update(id, patch) {
    const user = currentAdmin();
    const project = projectAccess(id);
    if (patch.name !== undefined && !patch.name.trim())
      throw new Error("Escribe el nombre del proyecto");
    if (
      patch.memberIds?.some(
        (id) => !getDb().profiles.some((p) => p.id === id && p.active),
      )
    )
      throw new Error("Miembro no válido");
    const before = { ...project };
    Object.assign(project, patch);
    audit("projects", id, "update", before, project, user.id);
    save();
    return delay(project);
  },
};
function newId(prefix: string): Id {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function audit(
  table: string,
  recordId: Id,
  action: AuditAction,
  before: unknown,
  after: unknown,
  userId: Id,
) {
  getDb().auditLog.push({
    id: newId("au"),
    table,
    recordId,
    action,
    before: before === null ? null : structuredClone(before),
    after: after === null ? null : structuredClone(after),
    userId,
    createdAt: new Date().toISOString(),
  });
}

function findTask(id: Id): Task {
  const task = getDb().tasks.find((t) => t.id === id);
  if (!task) throw new Error("La tarea no existe");
  return task;
}

function assertHours(hours: number) {
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24)
    throw new Error("Las horas deben estar entre 0 y 24");
}

function assertActivity(projectId?: Id | null, evidenceUrl?: string | null) {
  if (projectId && !getDb().projects.some((p) => p.id === projectId))
    throw new Error("El proyecto no existe");
  if (evidenceUrl && !/^https?:\/\/[^\s]+$/i.test(evidenceUrl))
    throw new Error("Usa un enlace http o https");
}

function assertInterval(
  startedAt: string,
  hours: number,
  userId: Id,
  exclude?: Id,
) {
  const start = new Date(startedAt).getTime();
  const end = start + hours * HOUR_MS;
  if (!Number.isFinite(start) || end > Date.now())
    throw new Error("El registro no puede terminar en el futuro");
  const overlap = getDb().timeEntries.some(
    (e) =>
      e.id !== exclude &&
      e.userId === userId &&
      !e.voidedAt &&
      !e.draft &&
      (e.source || e.endedAt === null) &&
      start < (e.endedAt ? new Date(e.endedAt).getTime() : Date.now()) &&
      end > new Date(e.startedAt).getTime(),
  );
  if (overlap) throw new Error("Este horario se superpone con otro registro");
}

/** Cierra un registro abierto: fija el fin y calcula las horas. */
function closeEntry(entry: TimeEntry, now: Date, userId: Id) {
  const before = { ...entry };
  const segments = entry.segments ?? [];
  if (entry.timerState !== "paused")
    segments.push({
      start: entry.segmentStartedAt ?? entry.startedAt,
      end: now.toISOString(),
    });
  entry.segments = segments;
  entry.endedAt = now.toISOString();
  entry.elapsedMs = segments.reduce(
    (sum, segment) =>
      sum + Math.max(0, Date.parse(segment.end) - Date.parse(segment.start)),
    0,
  );
  entry.hours = entry.elapsedMs / HOUR_MS;
  entry.segmentStartedAt = null;
  entry.draft = true;
  const db = getDb();
  db.hoursDrafts ??= [];
  let draft = db.hoursDrafts.find(
    (d) =>
      d.userId === entry.userId && d.taskId === entry.taskId && !d.submittedAt,
  );
  if (!draft) {
    draft = {
      id: newId("draft"),
      userId: entry.userId,
      taskId: entry.taskId,
      projectId: entry.projectId ?? null,
      title: entry.description ?? "Trabajo realizado",
      date: todayLima(now),
      hours: 0,
      measured: true,
      entryIds: [],
    };
    db.hoursDrafts.push(draft);
  }
  if (!draft.measured) draft.hours = 0;
  draft.measured = true;
  draft.hours += entry.hours;
  draft.entryIds.push(entry.id);
  audit("time_entries", entry.id, "update", before, entry, userId);
}

function ownEntry(id: Id, userId: Id): TimeEntry {
  const entry = getDb().timeEntries.find((e) => e.id === id);
  if (!entry) throw new Error("El registro no existe");
  if (entry.userId !== userId)
    throw new Error("Solo puedes modificar tus propios registros");
  return entry;
}

export const sprints: SprintService = {
  async listByProject(projectId) {
    projectAccess(projectId);
    return delay(getDb().sprints.filter((s) => s.projectId === projectId));
  },
  async getActive(projectId) {
    projectAccess(projectId);
    return delay(
      getDb().sprints.find(
        (s) => s.projectId === projectId && s.status === "active",
      ) ?? null,
    );
  },
  async create(input) {
    const user = currentAdmin();
    const db = getDb();
    if (!db.projects.some((p) => p.id === input.projectId))
      throw new Error("El proyecto no existe");
    if (input.endDate < input.startDate)
      throw new Error("El fin del sprint no puede ser anterior al inicio");
    if (!input.goal.trim()) throw new Error("Escribe el objetivo del sprint");
    const hasActive = db.sprints.some(
      (s) => s.projectId === input.projectId && s.status === "active",
    );
    const sprint: Sprint = {
      ...input,
      goal: input.goal.trim(),
      id: newId("s"),
      status: hasActive ? "planned" : "active",
    };
    db.sprints.push(sprint);
    audit("sprints", sprint.id, "create", null, sprint, user.id);
    save();
    return delay(sprint);
  },
  close: pending("SprintService.close"),
};
export const tasks: TaskService = {
  async list(filter = {}) {
    const user = currentUser();
    const projectBoard = Boolean(filter.projectId);
    if (filter.projectId) projectAccess(filter.projectId);
    return delay(
      getDb().tasks.filter(
        (t) =>
          (user.role === "admin" || projectBoard || t.assigneeId === user.id) &&
          (!filter.projectId || t.projectId === filter.projectId) &&
          (!filter.sprintId || t.sprintId === filter.sprintId) &&
          (!filter.assigneeId || t.assigneeId === filter.assigneeId),
      ),
    );
  },
  async create(input) {
    const user = currentAdmin();
    const db = getDb();
    validateTask(input);
    if (!input.title.trim()) throw new Error("Escribe el título de la tarea");
    if (
      input.assigneeId &&
      !db.profiles.some((p) => p.id === input.assigneeId && p.active)
    ) {
      throw new Error("El responsable no existe");
    }
    const task: Task = {
      ...input,
      labels: input.labels?.map((l) => ({
        ...getDb().projectLabels!.find((stored) => stored.id === l.id)!,
      })),
      title: input.title.trim(),
      id: newId("t"),
      status: input.status ?? "todo",
    };
    db.tasks.push(task);
    audit("tasks", task.id, "create", null, task, user.id);
    save();
    return delay(task);
  },
  async update(id, patch) {
    const user = currentUser();
    const task = findTask(id);
    if (user.role !== "admin") {
      ownTask(task, user);
      if (Object.keys(patch).some((k) => !["link", "status"].includes(k)))
        throw new Error(
          "Solo el administrador edita la asignación y el contenido",
        );
    }
    validateTask({ ...task, ...patch });
    if (patch.title !== undefined && !patch.title.trim())
      throw new Error("Escribe el título de la tarea");
    const before = { ...task };
    Object.assign(
      task,
      patch,
      patch.title !== undefined ? { title: patch.title.trim() } : {},
    );
    task.labels = task.labels?.map((l) => ({
      ...getDb().projectLabels!.find((stored) => stored.id === l.id)!,
    }));
    if (task.status === "done") prepareHours(task);
    audit("tasks", task.id, "update", before, task, user.id);
    save();
    return delay(task);
  },
  async move(id, status) {
    const user = currentUser();
    const task = findTask(id);
    if (user.role !== "admin") ownTask(task, user);
    if (!["todo", "in_progress", "review", "done"].includes(status))
      throw new Error("Estado no válido");
    if (task.status === status) return delay(task);
    const before = { ...task };
    task.status = status;
    if (task.status === "done") prepareHours(task);
    audit("tasks", task.id, "update", before, task, user.id);
    save();
    return delay(task);
  },
};
const timeImplementation: TimeService = {
  async pause() {
    const user = currentUser();
    const entry = getDb().timeEntries.find(
      (e) => e.userId === user.id && !e.endedAt && !e.voidedAt,
    );
    if (!entry || entry.timerState === "paused") return delay(entry ?? null);
    const now = new Date().toISOString();
    entry.segments ??= [];
    entry.segments.push({
      start: entry.segmentStartedAt ?? entry.startedAt,
      end: now,
    });
    entry.elapsedMs = entry.segments.reduce(
      (n, s) => n + Date.parse(s.end) - Date.parse(s.start),
      0,
    );
    entry.segmentStartedAt = null;
    entry.timerState = "paused";
    save();
    return delay(entry);
  },
  async resume() {
    const user = currentUser();
    const entry = getDb().timeEntries.find(
      (e) => e.userId === user.id && !e.endedAt && !e.voidedAt,
    );
    if (!entry || entry.timerState !== "paused") return delay(entry ?? null);
    entry.timerState = "running";
    entry.segmentStartedAt = new Date().toISOString();
    save();
    return delay(entry);
  },
  async listDrafts() {
    const user = currentUser();
    return delay(
      (getDb().hoursDrafts ?? []).filter(
        (d) => d.userId === user.id && !d.submittedAt,
      ),
    );
  },
  async submitDrafts(input) {
    const user = currentUser();
    const db = getDb();
    if (
      !input.items.length ||
      new Set(input.items.map((i) => i.id)).size !== input.items.length
    )
      throw new Error("Selecciona tareas distintas");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
      input.date > todayLima() ||
      todayLima(new Date(`${input.date}T12:00:00-05:00`)) !== input.date
    )
      throw new Error("Fecha no válida");
    const drafts = input.items.map((item) => {
      assertHours(item.hours);
      const draft = db.hoursDrafts?.find(
        (d) => d.id === item.id && d.userId === user.id && !d.submittedAt,
      );
      if (!draft) throw new Error("El borrador ya no está disponible");
      return { draft, hours: item.hours };
    });
    const hours = drafts.reduce((sum, d) => sum + d.hours, 0);
    assertHours(hours);
    const now = new Date().toISOString();
    const allocations = drafts
      .filter((d) => d.draft.taskId)
      .map((d) => ({
        taskId: d.draft.taskId!,
        title: d.draft.title,
        projectId: d.draft.projectId,
        hours: d.hours,
      }));
    const startedAt = new Date(`${input.date}T12:00:00-05:00`).toISOString();
    const entry: TimeEntry = {
      id: newId("h"),
      userId: user.id,
      taskId: drafts.length === 1 ? drafts[0].draft.taskId : null,
      projectId: drafts.length === 1 ? drafts[0].draft.projectId : null,
      description:
        input.description?.trim() ||
        drafts.map((d) => d.draft.title).join(" · "),
      allocations,
      hours,
      startedAt,
      endedAt: new Date(Date.parse(startedAt) + hours * HOUR_MS).toISOString(),
      createdAt: now,
      paid: false,
      validated: false,
      validatedAt: null,
      voidedAt: null,
      voidReason: null,
    };
    // Keep real intervals only when their duration/date match the confirmed time.
    const measured = drafts
      .flatMap((d) =>
        d.draft.entryIds.map((id) => db.timeEntries.find((e) => e.id === id)!),
      )
      .filter(Boolean);
    const segments = measured
      .flatMap((e) => e.segments ?? [])
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    const measuredHours = segments.reduce(
      (sum, s) => sum + (Date.parse(s.end) - Date.parse(s.start)) / HOUR_MS,
      0,
    );
    if (
      drafts.every(
        (d) => d.draft.measured && Math.abs(d.hours - d.draft.hours) < 0.00001,
      ) &&
      segments.length &&
      drafts.every((d) => d.draft.date === input.date) &&
      Math.abs(measuredHours - hours) < 0.00001
    ) {
      entry.source = "timer";
      entry.segments = segments;
      entry.startedAt = segments[0].start;
      entry.endedAt = segments[segments.length - 1].end;
    }
    db.timeEntries.push(entry);
    for (const { draft } of drafts) draft.submittedAt = now;
    audit("time_entries", entry.id, "create", null, entry, user.id);
    save();
    return delay(entry);
  },
  async listEntries(filter = {}) {
    const user = currentUser();
    const from = filter.from ? new Date(filter.from).getTime() : -Infinity;
    const to = filter.to ? new Date(filter.to).getTime() : Infinity;
    return delay(
      getDb().timeEntries.filter((e) => {
        const started = new Date(e.startedAt).getTime();
        return (
          !e.draft &&
          (user.role !== "collaborator" || e.userId === user.id) &&
          (!filter.userId || e.userId === filter.userId) &&
          (!filter.taskId || e.taskId === filter.taskId) &&
          started >= from &&
          started <= to
        );
      }),
    );
  },
  async getRunning() {
    const userId = getSessionUserId();
    return delay(
      getDb().timeEntries.find(
        (e) => e.userId === userId && e.endedAt === null && !e.voidedAt,
      ) ?? null,
    );
  },
  async start(taskId, activity) {
    const user = currentUser();
    const db = getDb();
    const task = taskId ? findTask(taskId) : null;
    if (task) ownTask(task, user);
    if (!task && (activity?.description?.trim().length ?? 0) < 8)
      throw new Error("Describe el trabajo que vas a realizar");
    assertActivity(activity?.projectId, activity?.evidenceUrl);
    const now = new Date();
    // Un solo temporizador abierto por persona: iniciar uno detiene el anterior.
    for (const open of db.timeEntries.filter(
      (e) => e.userId === user.id && e.endedAt === null && !e.voidedAt,
    )) {
      closeEntry(open, now, user.id);
    }
    const entry: TimeEntry = {
      id: newId("h"),
      userId: user.id,
      taskId,
      projectId: task?.projectId ?? activity?.projectId ?? null,
      description: activity?.description?.trim() ?? task?.title,
      evidenceUrl: activity?.evidenceUrl ?? null,
      source: "timer",
      timerState: "running",
      segmentStartedAt: now.toISOString(),
      segments: [],
      elapsedMs: 0,
      startedAt: now.toISOString(),
      endedAt: null,
      hours: 0,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: now.toISOString(),
      voidedAt: null,
      voidReason: null,
    };
    db.timeEntries.push(entry);
    audit("time_entries", entry.id, "create", null, entry, user.id);
    // Al iniciar el temporizador, la tarea pasa a "En progreso".
    if (task?.status === "todo") {
      const before = { ...task };
      task.status = "in_progress";
      audit("tasks", task.id, "update", before, task, user.id);
    }
    save();
    return delay(entry);
  },
  async stop() {
    const user = currentUser();
    const open = getDb().timeEntries.find(
      (e) => e.userId === user.id && e.endedAt === null && !e.voidedAt,
    );
    if (!open) return delay(null);
    closeEntry(open, new Date(), user.id);
    save();
    return delay(open);
  },
  async addManual({
    taskId,
    date,
    hours,
    projectId,
    description,
    evidenceUrl,
    startTime,
  }) {
    const user = currentUser();
    const task = taskId ? findTask(taskId) : null;
    if (task) ownTask(task, user);
    if (projectId && !task) projectAccess(projectId);
    if (!task && (description?.trim().length ?? 0) < 8)
      throw new Error("Describe el trabajo realizado");
    assertActivity(projectId, evidenceUrl);
    assertHours(hours);
    if (date > todayLima())
      throw new Error("No puedes registrar horas en una fecha futura");
    // Lima no tiene horario de verano (UTC-5): el mediodía de ese día es una hora segura.
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      (startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime))
    )
      throw new Error("Fecha u hora no válida");
    const start = new Date(`${date}T${startTime ?? "12:00"}:00-05:00`);
    if (!Number.isFinite(start.getTime()) || todayLima(start) !== date)
      throw new Error("Fecha no válida");
    const startedAt = start.toISOString();
    if (startTime) assertInterval(startedAt, hours, user.id);
    const now = new Date().toISOString();
    const entry: TimeEntry = {
      id: newId("h"),
      userId: user.id,
      taskId,
      projectId: task?.projectId ?? projectId ?? null,
      description: description?.trim() ?? task?.title,
      evidenceUrl: evidenceUrl || null,
      source: startTime ? "manual" : undefined,
      startedAt,
      endedAt: new Date(
        new Date(startedAt).getTime() + hours * HOUR_MS,
      ).toISOString(),
      hours,
      paid: false,
      validated: false,
      validatedAt: null,
      createdAt: now,
      voidedAt: null,
      voidReason: null,
    };
    getDb().timeEntries.push(entry);
    // Manual confirmation of a task replaces its pending suggestion, preventing double registration.
    if (taskId)
      for (const draft of getDb().hoursDrafts ?? []) {
        if (
          draft.userId === user.id &&
          draft.taskId === taskId &&
          !draft.submittedAt
        )
          draft.submittedAt = now;
      }
    audit("time_entries", entry.id, "create", null, entry, user.id);
    save();
    return delay(entry);
  },
  async update(id, patch) {
    const user = currentUser();
    const entry = ownEntry(id, user.id);
    if (entry.endedAt === null)
      throw new Error("Detén el temporizador antes de editar el registro");
    if (!canEditEntry(entry, new Date(), getDb().settings)) {
      throw new Error(
        "Este registro ya no se puede editar: pasaron los días permitidos o está pagado/anulado",
      );
    }
    if (patch.taskId) ownTask(findTask(patch.taskId), user);
    if (patch.hours !== undefined) assertHours(patch.hours);
    assertActivity(patch.projectId, patch.evidenceUrl);
    if (patch.description !== undefined && patch.description.trim().length < 8)
      throw new Error("Describe el trabajo realizado");
    const before = { ...entry };
    const startedAt = patch.startedAt ?? entry.startedAt;
    const hours = patch.hours ?? entry.hours;
    if (
      !patch.taskId &&
      patch.taskId !== undefined &&
      (patch.description?.trim().length ?? entry.description?.length ?? 0) < 8
    )
      throw new Error("Describe el trabajo realizado");
    assertInterval(startedAt, hours, user.id, entry.id);
    if (entry.allocations?.length) {
      if (patch.taskId !== undefined && patch.taskId !== entry.taskId)
        throw new Error("Conserva las tareas de este registro agrupado");
      const ratio = hours / entry.hours;
      entry.allocations = entry.allocations.map((a) => ({
        ...a,
        hours: a.hours * ratio,
      }));
    }
    if (patch.startedAt !== undefined || patch.hours !== undefined)
      entry.segments = undefined;
    Object.assign(entry, patch, {
      taskId: patch.taskId === undefined ? entry.taskId : patch.taskId,
      description: patch.description?.trim() ?? entry.description,
      source: patch.startedAt ? "manual" : entry.source,
      validated: false,
      validatedAt: null,
      validatedBy: null,
      reviewNote: null,
      reviewedBy: null,
      startedAt,
      hours,
      endedAt: new Date(
        new Date(startedAt).getTime() + hours * HOUR_MS,
      ).toISOString(),
    });
    audit("time_entries", entry.id, "update", before, entry, user.id);
    save();
    return delay(entry);
  },
  async void(id, reason) {
    const user = currentUser();
    const entry = ownEntry(id, user.id);
    if (entry.voidedAt) throw new Error("El registro ya está anulado");
    if (entry.validated)
      throw new Error("No se puede anular un registro validado");
    if (reason.trim().length < 3)
      throw new Error("Escribe el motivo de la anulación");
    const before = { ...entry };
    entry.voidedAt = new Date().toISOString();
    entry.voidReason = reason.trim();
    audit("time_entries", entry.id, "void", before, entry, user.id);
    save();
    return delay(entry);
  },
  async validate(entryIds) {
    const user = currentPartner();
    const entries = [...new Set(entryIds)].map((id) => {
      const entry = getDb().timeEntries.find((e) => e.id === id);
      if (
        !entry ||
        entry.draft ||
        entry.voidedAt ||
        !entry.endedAt ||
        entry.hours <= 0
      )
        throw new Error("Solo se revisan registros finalizados y vigentes");
      if (entry.userId === user.id)
        throw new Error("No puedes aprobar tus propias horas");
      if (entry.validated) throw new Error("El registro ya está aprobado");
      return entry;
    });
    for (const entry of entries) {
      const before = { ...entry };
      Object.assign(entry, {
        validated: true,
        validatedAt: new Date().toISOString(),
        validatedBy: user.id,
        reviewNote: null,
        reviewedBy: user.id,
      });
      audit("time_entries", entry.id, "update", before, entry, user.id);
    }
    save();
    return delay(entries);
  },
  async requestClarification(id, note) {
    const user = currentPartner();
    const entry = getDb().timeEntries.find((e) => e.id === id);
    if (
      !entry ||
      entry.draft ||
      entry.userId === user.id ||
      entry.validated ||
      entry.voidedAt ||
      !entry.endedAt
    )
      throw new Error("Este registro no está disponible para revisión");
    if (note.trim().length < 8)
      throw new Error("Explica qué necesita aclaración");
    const before = { ...entry };
    entry.reviewNote = note.trim();
    entry.reviewedBy = user.id;
    audit("time_entries", id, "update", before, entry, user.id);
    save();
    return delay(entry);
  },
};
async function timerLock<T>(operation: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks)
    return navigator.locks.request("vexa.timer.write", operation);
  return operation();
}

export const time: TimeService = {
  ...timeImplementation,
  start: (taskId, activity) =>
    timerLock(() => timeImplementation.start(taskId, activity)),
  pause: () => timerLock(() => timeImplementation.pause()),
  resume: () => timerLock(() => timeImplementation.resume()),
  stop: () => timerLock(() => timeImplementation.stop()),
  submitDrafts: (input) =>
    timerLock(() => timeImplementation.submitDrafts(input)),
};
