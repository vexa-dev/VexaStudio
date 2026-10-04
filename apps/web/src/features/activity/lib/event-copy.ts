import {
  CalendarRange,
  CirclePause,
  CirclePlay,
  CircleSlash,
  Clock,
  FolderKanban,
  History,
  ListChecks,
  MessageCircleQuestion,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Settings,
  ShieldCheck,
  SquareCheckBig,
  Square,
  Tag,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { AuditChange, AuditEventType, AuditLogEntry } from "@vexa/domain/audit";
import { formatDateTimeSeconds } from "@vexa/domain/format";
import { fieldLabel, formatFieldValue } from "./format-value";

export type EventCategory =
  | "tasks"
  | "hours"
  | "timer"
  | "projects"
  | "team"
  | "system";

export const categoryLabel: Record<EventCategory, string> = {
  tasks: "Tareas",
  hours: "Horas",
  timer: "Reloj",
  projects: "Proyectos",
  team: "Equipo",
  system: "Sistema",
};

/** Eventos de cada categoría: es la base del filtro por tipo de evento. */
export const CATEGORY_EVENT_TYPES: Record<EventCategory, AuditEventType[]> = {
  tasks: ["task.created", "task.edited", "task.moved", "task.assigned"],
  hours: [
    "hours.created",
    "hours.confirmed",
    "hours.edited",
    "hours.approved",
    "hours.clarification_requested",
    "hours.voided",
  ],
  timer: [
    "timer.started",
    "timer.stopped",
    "timer.paused",
    "timer.resumed",
    "timer.recovered",
  ],
  projects: [
    "project.created",
    "project.updated",
    "project.members_changed",
    "project_label.created",
    "project_label.updated",
    "sprint.created",
  ],
  team: [
    "member.created",
    "member.updated",
    "member.role_changed",
    "member.deactivated",
  ],
  system: ["settings.changed"],
};

const categoryByType = new Map<string, EventCategory>(
  (Object.entries(CATEGORY_EVENT_TYPES) as [EventCategory, AuditEventType[]][]).flatMap(
    ([category, types]) => types.map((type) => [type, category] as const),
  ),
);

/** Categoría de un evento; un tipo que esta versión no conoce cae en "Sistema". */
export function eventCategory(eventType: AuditEventType): EventCategory {
  return categoryByType.get(eventType) ?? "system";
}

const ICONS: Record<AuditEventType, LucideIcon> = {
  "task.created": Plus,
  "task.edited": Pencil,
  "task.moved": ListChecks,
  "task.assigned": UserPlus,
  "project.created": FolderKanban,
  "project.updated": FolderKanban,
  "project.members_changed": Users,
  "project_label.created": Tag,
  "project_label.updated": Tag,
  "sprint.created": CalendarRange,
  "hours.created": Clock,
  "hours.confirmed": SquareCheckBig,
  "hours.edited": Pencil,
  "hours.approved": ShieldCheck,
  "hours.clarification_requested": MessageCircleQuestion,
  "hours.voided": CircleSlash,
  "timer.started": Play,
  "timer.stopped": Square,
  "timer.paused": CirclePause,
  "timer.resumed": CirclePlay,
  "timer.recovered": RotateCcw,
  "member.created": UserPlus,
  "member.updated": UserCog,
  "member.role_changed": UserCog,
  "member.deactivated": UserMinus,
  "settings.changed": Settings,
};

/** Icono del evento; `History` para tipos que esta versión no conoce. */
export function eventIcon(eventType: AuditEventType): LucideIcon {
  return ICONS[eventType] ?? History;
}

/** Hora `HH:mm:ss` en Lima de un instante ISO. */
export function timeOfDay(iso: string): string {
  return formatDateTimeSeconds(iso).slice(11);
}

export interface PhraseContext {
  /** Nombre corto de quien actuó ("Rober"). */
  actorName: string;
  /** Resuelve identificadores de personas que aparezcan en los cambios. */
  memberName?: (id: string) => string | undefined;
}

const quote = (label: string) => (label ? `«${label}»` : "");

function change(
  changes: AuditChange[],
  field: string,
): AuditChange | undefined {
  return changes.find((c) => c.field === field);
}

function fieldList(changes: AuditChange[]): string {
  const names = changes.map((c) => fieldLabel(c.field));
  return names.length ? ` (${names.join(", ")})` : "";
}

/**
 * Frase del evento en español, lista para mostrar tras el nombre del actor:
 * «Rober movió «Diseñar login» de En progreso a En revisión».
 */
export function eventPhrase(entry: AuditLogEntry, ctx: PhraseContext): string {
  const { actorName, memberName } = ctx;
  const { changes, entity } = entry;
  const name = quote(entity.label);
  const of = (noun: string) => (name ? `${noun} ${name}` : noun);
  const value = (field: string, v: unknown) =>
    formatFieldValue(field, v, memberName);

  switch (entry.eventType) {
    case "task.created":
      return `${actorName} creó ${name ? `la tarea ${name}` : "una tarea"}`;
    case "task.edited":
      return `${actorName} editó ${name ? `la tarea ${name}` : "una tarea"}${fieldList(changes)}`;
    case "task.moved": {
      const status = change(changes, "status");
      const route = status
        ? ` de ${value("status", status.from)} a ${value("status", status.to)}`
        : "";
      return `${actorName} movió ${name || "una tarea"}${route}`;
    }
    case "task.assigned": {
      const to = change(changes, "assigneeId")?.to;
      return `${actorName} ${to ? "asignó" : "quitó el responsable de"} ${name || "una tarea"}${to ? ` a ${value("assigneeId", to)}` : ""}`;
    }
    case "project.created":
      return `${actorName} creó el ${of("proyecto")}`;
    case "project.updated":
      return `${actorName} actualizó el ${of("proyecto")}${fieldList(changes)}`;
    case "project.members_changed":
      return `${actorName} cambió los miembros del ${of("proyecto")}`;
    case "project_label.created":
      return `${actorName} creó la ${of("etiqueta")}`;
    case "project_label.updated":
      return `${actorName} actualizó la ${of("etiqueta")}`;
    case "sprint.created":
      return `${actorName} creó el ${of("sprint")}`;
    case "hours.created": {
      const hours = change(changes, "hours")?.to;
      const amount = typeof hours === "number" ? ` ${hours} h` : " horas";
      return `${actorName} registró${amount}${name ? ` en ${name}` : ""}`;
    }
    case "hours.confirmed":
      return `${actorName} confirmó las ${of("horas")}`;
    case "hours.edited":
      return `${actorName} editó las ${of("horas")}${fieldList(changes)}`;
    case "hours.approved":
      return `${actorName} aprobó las ${of("horas")}`;
    case "hours.clarification_requested":
      return `${actorName} pidió aclarar las ${of("horas")}`;
    case "hours.voided":
      return `${actorName} anuló las ${of("horas")}`;
    case "timer.started":
      return `${actorName} inició el reloj${name ? ` en ${name}` : ""}`;
    case "timer.stopped":
      return `${actorName} detuvo el reloj${name ? ` de ${name}` : ""}`;
    case "timer.paused":
      return `${actorName} pausó el reloj${name ? ` de ${name}` : ""}`;
    case "timer.resumed":
      return `${actorName} reanudó el reloj${name ? ` de ${name}` : ""}`;
    case "timer.recovered":
      return `${actorName} recuperó el reloj tras un cierre inesperado${name ? ` de ${name}` : ""}`;
    case "member.created":
      return `${actorName} incorporó a ${name || "un miembro"}`;
    case "member.updated":
      return `${actorName} actualizó el perfil de ${name || "un miembro"}${fieldList(changes)}`;
    case "member.role_changed": {
      const role = change(changes, "role");
      const route = role
        ? `, de ${value("role", role.from)} a ${value("role", role.to)}`
        : "";
      return `${actorName} cambió el rol de ${name || "un miembro"}${route}`;
    }
    case "member.deactivated":
      return `${actorName} desactivó a ${name || "un miembro"}`;
    case "settings.changed":
      return `${actorName} cambió los ajustes${fieldList(changes)}`;
    default:
      return `${actorName} registró «${String(entry.eventType)}»${name ? ` en ${name}` : ""}`;
  }
}
