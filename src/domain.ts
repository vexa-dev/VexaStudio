import { z } from "zod";

export const taskStatus = z.enum(["Pendiente", "En curso", "Completada"]);
export const projectStatus = z.enum(["Activo", "Pausado", "Completado"]);
const name = z
  .string()
  .trim()
  .min(2, "Escribe al menos 2 caracteres.")
  .max(100, "Máximo 100 caracteres.");
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Selecciona una fecha válida.")
  .refine((value) => {
    const parsed = new Date(`${value}T12:00:00Z`);
    return (
      !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
    );
  }, "La fecha no existe.");
export const projectInput = z.object({
  name,
  description: z.string().trim().max(500),
  status: projectStatus,
});
export const sprintInput = z
  .object({ name, start: date, end: date })
  .refine((v) => v.end >= v.start, {
    path: ["end"],
    message: "El cierre debe ser posterior al inicio.",
  });
export const taskInput = z.object({ title: name, status: taskStatus });
export const hourInput = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto."),
  date,
  minutes: z
    .number()
    .int()
    .positive("La duración debe ser mayor que cero.")
    .max(1440, "Máximo 24 horas por registro."),
  description: name,
});
export const expenseInput = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto."),
  date,
  category: z.enum(["Software", "Equipo", "Servicios", "Otros"]),
  description: name,
  amount: z
    .number()
    .min(0.01, "El importe mínimo es S/ 0.01.")
    .max(1000000, "El importe supera el máximo de la demo.")
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
      "Usa como máximo dos decimales.",
    ),
});
export type ProjectInput = z.infer<typeof projectInput>;
export type TaskInput = z.infer<typeof taskInput>;
export type HourInput = z.infer<typeof hourInput>;
export type ExpenseInput = z.infer<typeof expenseInput>;
const projectSchema = projectInput.extend({
  id: z.string(),
  sprint: sprintInput,
});
const taskSchema = taskInput.extend({ id: z.string(), projectId: z.string() });
const hourSchema = hourInput.extend({ id: z.string() });
const expenseSchema = expenseInput.extend({ id: z.string() });
export const timerSchema = z.object({
  projectId: z.string(),
  description: z.string(),
  startedAt: z.number().nonnegative().nullable(),
  accumulatedMs: z.number().nonnegative(),
});
export const stateSchema = z
  .object({
    version: z.literal(1),
    projects: z.array(projectSchema),
    tasks: z.array(taskSchema),
    hours: z.array(hourSchema),
    expenses: z.array(expenseSchema),
    timer: timerSchema.nullable(),
  })
  .refine((s) => {
    const ids = new Set(s.projects.map((p) => p.id));
    return (
      s.tasks.every((t) => ids.has(t.projectId)) &&
      s.hours.every((h) => ids.has(h.projectId)) &&
      s.expenses.every((e) => ids.has(e.projectId)) &&
      (!s.timer || ids.has(s.timer.projectId))
    );
  }, "Hay registros con proyectos desconocidos.");
export type Project = z.infer<typeof projectSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Hour = z.infer<typeof hourSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type Timer = z.infer<typeof timerSchema>;
export type DemoState = z.infer<typeof stateSchema>;
export const STORAGE_KEY = "vexa.observatorio.v1";
export function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
    timeZone: "America/Lima",
  }).format(new Date(`${value}T12:00:00Z`));
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    value,
  );
export const duration = (minutes: number) =>
  `${Math.floor(minutes / 60)} h ${minutes % 60 ? `${minutes % 60} min` : ""}`.trim();
export function elapsed(timer: Timer, now: number) {
  return (
    timer.accumulatedMs +
    (timer.startedAt === null ? 0 : Math.max(0, now - timer.startedAt))
  );
}
export function pauseTimer(timer: Timer, now: number): Timer {
  return { ...timer, accumulatedMs: elapsed(timer, now), startedAt: null };
}
export function totals(s: DemoState, projectId?: string) {
  const tasks = s.tasks.filter((t) => !projectId || t.projectId === projectId);
  return {
    tasks: tasks.length,
    done: tasks.filter((t) => t.status === "Completada").length,
    minutes: s.hours
      .filter((h) => !projectId || h.projectId === projectId)
      .reduce((sum, h) => sum + h.minutes, 0),
    expenses:
      s.expenses
        .filter((e) => !projectId || e.projectId === projectId)
        .reduce((sum, e) => sum + Math.round(e.amount * 100), 0) / 100,
  };
}
export function seed(): DemoState {
  const d = today();
  return {
    version: 1,
    projects: [
      {
        id: "p1",
        name: "Identidad VEXA",
        description: "Una nueva expresión para lo que construimos juntos.",
        status: "Activo",
        sprint: { name: "Sistema de marca", start: d, end: d },
      },
      {
        id: "p2",
        name: "Studio platform",
        description: "El espacio donde las ideas se convierten en trabajo.",
        status: "Activo",
        sprint: { name: "Primera experiencia", start: d, end: d },
      },
      {
        id: "p3",
        name: "Experimentos",
        description: "Un laboratorio para explorar nuevas posibilidades.",
        status: "Pausado",
        sprint: { name: "Exploración", start: d, end: d },
      },
    ],
    tasks: [
      {
        id: "t1",
        projectId: "p1",
        title: "Definir el lenguaje visual",
        status: "Completada",
      },
      {
        id: "t2",
        projectId: "p1",
        title: "Explorar el símbolo tridimensional",
        status: "En curso",
      },
      {
        id: "t3",
        projectId: "p1",
        title: "Preparar la guía de marca",
        status: "Pendiente",
      },
      {
        id: "t4",
        projectId: "p2",
        title: "Diseñar el espacio de trabajo",
        status: "En curso",
      },
      {
        id: "t5",
        projectId: "p2",
        title: "Organizar los flujos de registro",
        status: "Pendiente",
      },
      {
        id: "t6",
        projectId: "p2",
        title: "Investigar referencias",
        status: "Completada",
      },
      {
        id: "t7",
        projectId: "p3",
        title: "Explorar materiales de vidrio",
        status: "Pendiente",
      },
    ],
    hours: [
      {
        id: "h1",
        projectId: "p1",
        date: d,
        minutes: 150,
        description: "Exploración de identidad",
      },
      {
        id: "h2",
        projectId: "p2",
        date: d,
        minutes: 240,
        description: "Diseño de la experiencia",
      },
      {
        id: "h3",
        projectId: "p1",
        date: d,
        minutes: 90,
        description: "Revisión de conceptos",
      },
    ],
    expenses: [
      {
        id: "e1",
        projectId: "p1",
        date: d,
        category: "Software",
        description: "Herramientas de diseño",
        amount: 89.9,
      },
      {
        id: "e2",
        projectId: "p2",
        date: d,
        category: "Servicios",
        description: "Entorno de desarrollo",
        amount: 65,
      },
    ],
    timer: null,
  };
}
export function load(storage: Pick<Storage, "getItem">): {
  state: DemoState;
  warning: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: seed(), warning: "" };
    const result = stateSchema.safeParse(JSON.parse(raw));
    if (result.success) return { state: result.data, warning: "" };
    return {
      state: seed(),
      warning:
        "Los datos guardados no son compatibles. Se cargaron los ejemplos.",
    };
  } catch {
    return {
      state: seed(),
      warning:
        "No se pudo leer el almacenamiento. Puedes trabajar durante esta sesión.",
    };
  }
}
export function persist(storage: Pick<Storage, "setItem">, state: DemoState) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
