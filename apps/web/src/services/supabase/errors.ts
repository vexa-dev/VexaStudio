/**
 * Traduce los errores de Postgres/PostgREST a los mensajes que la interfaz ya muestra con el mock.
 * Las funciones SQL escriben sus mensajes en español sin acentos; aquí se restituyen comparando
 * con la lista de mensajes canónicos (los del mock y de las guardas de la base).
 */
export interface ErrorLike {
  message?: string;
  code?: string;
  details?: string | null;
}

/** Mensajes canónicos, con acentos. La comparación ignora acentos y mayúsculas. */
const CANONICAL_MESSAGES = [
  "Inicia sesión para continuar",
  "Tu rol no permite esta acción",
  "Solo un administrador puede gestionar proyectos y tareas",
  "No tienes acceso a este proyecto",
  "Solo puedes trabajar en tus tareas asignadas",
  "Máximo 20,000 caracteres en la descripción",
  "Las etiquetas deben pertenecer al proyecto de la tarea",
  "El proyecto no existe",
  "El sprint no pertenece al proyecto",
  "El responsable no existe",
  "Estimación no válida",
  "Usa un enlace http o https",
  "Escribe un nombre de hasta 40 caracteres",
  "Elige un color válido",
  "Ya existe una etiqueta con ese nombre",
  "La etiqueta no existe",
  "Escribe el nombre del proyecto",
  "Miembro no válido",
  "La tarea no existe",
  "Las horas deben estar entre 0 y 24",
  "El registro no puede terminar en el futuro",
  "Este horario se superpone con otro registro",
  "Solo puedes modificar tus propios registros",
  "Solo puedes cerrar tu propio reloj",
  "Solo puedes registrar tus propias horas",
  "El fin del sprint no puede ser anterior al inicio",
  "Escribe el objetivo del sprint",
  "Escribe el título de la tarea",
  "Solo el administrador edita la asignación y el contenido",
  "Estado no válido",
  "Selecciona tareas distintas",
  "Fecha no válida",
  "El borrador ya no está disponible",
  "Describe el trabajo que vas a realizar",
  "Describe el trabajo realizado",
  "No puedes registrar horas en una fecha futura",
  "Fecha u hora no válida",
  "Detén el temporizador antes de editar el registro",
  "Este registro ya no se puede editar: pasaron los días permitidos o está pagado/anulado",
  "Conserva las tareas de este registro agrupado",
  "El registro ya está anulado",
  "No se puede anular un registro validado",
  "Escribe el motivo de la anulación",
  "Solo se revisan registros finalizados y vigentes",
  "No puedes aprobar tus propias horas",
  "El registro ya está aprobado",
  "Este registro no está disponible para revisión",
  "Explica qué necesita aclaración",
  "El registro no existe",
  "Un registro nuevo no puede nacer revisado, pagado o anulado",
  "No puedes modificar la revisión de tus propias horas",
  "Solo puedes aprobar o pedir aclaración",
  "Operación de revisión no válida",
  "Al anular no se modifica nada más",
  "Este gasto ya no admite votos",
  "Solo puedes votar por ti",
  "Solo quien pagó el gasto puede anularlo",
  "El gasto ya está anulado",
  "El gasto no existe o no tienes permiso",
  "Solo puedes registrar gastos pagados por ti",
  "Un gasto registrado no se edita: se anula con motivo",
  "Solo un administrador registra reembolsos",
  "El estado del gasto lo define la votación",
  "Mes no válido: usa YYYY-MM",
];

const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .trim()
    .toLocaleLowerCase("es");

const CANONICAL = new Map(CANONICAL_MESSAGES.map((m) => [fold(m), m]));

/** Restricciones de la base con su mensaje para la persona usuaria. */
const CONSTRAINT_MESSAGES: Record<string, string> = {
  tasks_link_check: "Usa un enlace http o https",
  time_entries_evidence_url_check: "Usa un enlace http o https",
  tasks_description_check: "Máximo 20,000 caracteres en la descripción",
  tasks_estimate_hours_check: "Estimación no válida",
  tasks_title_check: "Escribe el título de la tarea",
  tasks_sprint_id_project_id_fkey: "El sprint no pertenece al proyecto",
  tasks_project_id_fkey: "El proyecto no existe",
  tasks_assignee_id_fkey: "El responsable no existe",
  project_labels_name_uidx: "Ya existe una etiqueta con ese nombre",
  project_labels_name_check: "Escribe un nombre de hasta 40 caracteres",
  project_labels_color_check: "Elige un color válido",
  projects_name_check: "Escribe el nombre del proyecto",
  sprints_goal_check: "Escribe el objetivo del sprint",
  sprints_check: "El fin del sprint no puede ser anterior al inicio",
};

const NETWORK = /failed to fetch|networkerror|load failed|fetch failed/i;

export function toServiceError(error: unknown): Error {
  const { message, code, details } = (
    typeof error === "object" && error !== null ? error : {}
  ) as ErrorLike;
  const text = `${message ?? ""} ${details ?? ""}`;
  const keep = (value: string) => new Error(value, { cause: error });

  if (NETWORK.test(message ?? ""))
    return keep("No se pudo conectar con el servidor. Revisa tu conexión.");
  for (const [constraint, mapped] of Object.entries(CONSTRAINT_MESSAGES))
    if (text.includes(`"${constraint}"`)) return keep(mapped);
  const canonical = message ? CANONICAL.get(fold(message)) : undefined;
  if (canonical) return keep(canonical);
  if (code === "PGRST301" || code === "PGRST303" || /jwt/i.test(message ?? ""))
    return keep("Inicia sesión para continuar");
  if (
    code === "42501" ||
    /row-level security|permission denied/i.test(message ?? "")
  )
    return keep("Tu rol no permite esta acción");
  if (code === "PGRST116" || code === "PGRST204")
    return keep("El registro no existe o no tienes permiso");
  if (code === "23503") return keep("El registro relacionado no existe");
  if (code === "23505") return keep("Ya existe un registro igual");
  return keep(message?.trim() || "Ocurrió un error inesperado");
}

interface Result<T> {
  data: T | null;
  error: ErrorLike | null;
}

/** Datos de una respuesta, o el error traducido. */
export function unwrap<T>(result: Result<T>): T {
  if (result.error) throw toServiceError(result.error);
  if (result.data === null) throw new Error("El servidor no devolvió datos");
  return result.data;
}

/** Como `unwrap`, pero un resultado vacío es válido (`maybeSingle`). */
export function unwrapMaybe<T>(result: Result<T>): T | null {
  if (result.error) throw toServiceError(result.error);
  return result.data;
}

/**
 * Servicio sin implementar, igual que en el mock: cada método falla con un mensaje claro en vez de
 * un `undefined is not a function`.
 */
export function notImplemented<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, method) {
      if (typeof method !== "string" || method === "then") return undefined;
      return () =>
        Promise.reject(new Error(`${name}.${method} aún no está implementado`));
    },
  });
}

/** Método de escritura sin implementar. */
export function pending(name: string): () => Promise<never> {
  return () => Promise.reject(new Error(`${name} aún no está implementado`));
}
