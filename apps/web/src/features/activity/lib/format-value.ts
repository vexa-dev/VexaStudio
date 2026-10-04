import { formatDateTimeSeconds } from "@vexa/domain/format";
import { roleLabel, taskStatusLabel } from "@/lib/labels";

/** Nombres visibles de los campos que el registro de actividad puede reportar. */
const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descripción",
  status: "Estado",
  assigneeId: "Responsable",
  projectId: "Proyecto",
  sprintId: "Sprint",
  estimateHours: "Estimación (h)",
  link: "Enlace",
  labels: "Etiquetas",
  hours: "Horas",
  startedAt: "Inicio",
  endedAt: "Fin",
  evidenceUrl: "Respaldo",
  taskId: "Tarea",
  userId: "Persona",
  name: "Nombre",
  color: "Color",
  goal: "Meta",
  startDate: "Fecha de inicio",
  endDate: "Fecha de fin",
  type: "Tipo",
  memberIds: "Miembros",
  role: "Rol",
  area: "Área",
  weeklyHours: "Horas por semana",
  active: "Activo",
  validated: "Aprobado",
  validatedAt: "Aprobado el",
  validatedBy: "Aprobado por",
  reviewNote: "Aclaración pedida",
  voidedAt: "Anulado el",
  voidReason: "Motivo de anulación",
  paid: "Pagado",
};

/** Nombre del campo; si no se conoce, convierte `camelCase` en una frase legible. */
export function fieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  const words = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const EMPTY = "—";

function isNamed(value: unknown): value is { name: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

/**
 * Texto de un valor del registro. Nunca lanza: lo desconocido se muestra como JSON compacto.
 * `memberName` resuelve identificadores de personas cuando la interfaz los conoce.
 */
export function formatFieldValue(
  field: string,
  value: unknown,
  memberName?: (id: string) => string | undefined,
): string {
  if (value === null || value === undefined || value === "") return EMPTY;
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (field === "status" && value in taskStatusLabel)
      return taskStatusLabel[value as keyof typeof taskStatusLabel];
    if (field === "role" && value in roleLabel)
      return roleLabel[value as keyof typeof roleLabel];
    if (ISO_INSTANT.test(value) && !Number.isNaN(Date.parse(value)))
      return formatDateTimeSeconds(value);
    if (/(^id$|Id$|By$)/.test(field)) return memberName?.(value) ?? value;
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY;
    const simple = value.map((item) =>
      isNamed(item)
        ? item.name
        : typeof item === "string" || typeof item === "number"
          ? String(item)
          : null,
    );
    if (simple.every((item) => item !== null)) return simple.join(", ");
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Recorta un texto largo y avisa si lo hizo, para ofrecer "Ver más". */
export function truncateText(
  text: string,
  max: number,
): { text: string; truncated: boolean } {
  if (text.length <= max) return { text, truncated: false };
  return { text: `${text.slice(0, max)}…`, truncated: true };
}
