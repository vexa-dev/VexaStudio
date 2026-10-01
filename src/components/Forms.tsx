import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  projectInput,
  taskInput,
  hourInput,
  expenseInput,
  sprintInput,
  today,
  type Project,
  type ProjectInput,
  type TaskInput,
  type HourInput,
  type ExpenseInput,
  type Hour,
  type Expense,
} from "../domain";
import { useDemo } from "../demo";
import { Empty, Field } from "./UI";
import type { z } from "zod";

export function ProjectForm({
  project,
  onDone,
}: {
  project?: Project;
  onDone: () => void;
}) {
  const { update, notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectInput),
    defaultValues: project || { name: "", description: "", status: "Activo" },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => {
        update((s) => ({
          ...s,
          projects: project
            ? s.projects.map((p) =>
                p.id === project.id ? { ...p, ...values } : p,
              )
            : [
                ...s.projects,
                {
                  ...values,
                  id: crypto.randomUUID(),
                  sprint: {
                    name: "Primer sprint",
                    start: today(),
                    end: today(),
                  },
                },
              ],
        }));
        notify(
          project
            ? "Proyecto actualizado."
            : "Proyecto creado. Añade las primeras tareas.",
        );
        onDone();
      })}
    >
      <Field label="Nombre del proyecto" error={errors.name?.message}>
        <input
          {...register("name")}
          aria-invalid={!!errors.name}
          placeholder="¿Qué vamos a construir?"
        />
      </Field>
      <Field label="Descripción" error={errors.description?.message}>
        <textarea
          {...register("description")}
          rows={4}
          aria-invalid={!!errors.description}
          placeholder="El propósito de este proyecto"
        />
      </Field>
      <Field label="Estado">
        <select {...register("status")}>
          <option>Activo</option>
          <option>Pausado</option>
          <option>Completado</option>
        </select>
      </Field>
      <button className="button primary" type="submit">
        {project ? "Guardar cambios" : "Crear proyecto"}
      </button>
    </form>
  );
}
export function TaskForm({
  projectId,
  onDone,
}: {
  projectId: string;
  onDone: () => void;
}) {
  const { update, notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskInput>({
    resolver: zodResolver(taskInput),
    defaultValues: { title: "", status: "Pendiente" },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => {
        update((s) => ({
          ...s,
          tasks: [
            ...s.tasks,
            { ...values, projectId, id: crypto.randomUUID() },
          ],
        }));
        notify("Tarea añadida.");
        onDone();
      })}
    >
      <Field label="Nombre de la tarea" error={errors.title?.message}>
        <input {...register("title")} aria-invalid={!!errors.title} />
      </Field>
      <Field label="Estado">
        <select {...register("status")}>
          <option>Pendiente</option>
          <option>En curso</option>
          <option>Completada</option>
        </select>
      </Field>
      <button className="button primary">Añadir tarea</button>
    </form>
  );
}
export function SprintForm({
  project,
  onDone,
}: {
  project: Project;
  onDone: () => void;
}) {
  const { update, notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof sprintInput>>({
    resolver: zodResolver(sprintInput),
    defaultValues: project.sprint,
  });
  return (
    <form
      onSubmit={handleSubmit((sprint) => {
        update((s) => ({
          ...s,
          projects: s.projects.map((p) =>
            p.id === project.id ? { ...p, sprint } : p,
          ),
        }));
        notify("Sprint actualizado.");
        onDone();
      })}
    >
      <Field label="Nombre del sprint" error={errors.name?.message}>
        <input {...register("name")} aria-invalid={!!errors.name} />
      </Field>
      <Field label="Inicio" error={errors.start?.message}>
        <input
          type="date"
          {...register("start")}
          aria-invalid={!!errors.start}
        />
      </Field>
      <Field label="Cierre" error={errors.end?.message}>
        <input type="date" {...register("end")} aria-invalid={!!errors.end} />
      </Field>
      <button className="button primary">Guardar sprint</button>
    </form>
  );
}
export function RecordForm({
  kind,
  hour,
  expense,
  onDone,
}: {
  kind: "hour" | "expense";
  hour?: Hour;
  expense?: Expense;
  onDone: () => void;
}) {
  const { state } = useDemo();
  if (!state.projects.length)
    return <Empty>Primero crea un proyecto para vincular este registro.</Empty>;
  return kind === "hour" ? (
    <HourForm hour={hour} onDone={onDone} />
  ) : (
    <ExpenseForm expense={expense} onDone={onDone} />
  );
}
function HourForm({ hour, onDone }: { hour?: Hour; onDone: () => void }) {
  const { state, update, notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<HourInput>({
    resolver: zodResolver(hourInput),
    defaultValues: hour || {
      projectId: state.projects[0]?.id || "",
      date: today(),
      minutes: 60,
      description: "",
    },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => {
        update((s) => ({
          ...s,
          hours: hour
            ? s.hours.map((h) => (h.id === hour.id ? { ...h, ...values } : h))
            : [...s.hours, { ...values, id: crypto.randomUUID() }],
        }));
        notify("Registro de horas guardado.");
        onDone();
      })}
    >
      <Field label="Proyecto" error={errors.projectId?.message}>
        <select {...register("projectId")}>
          {state.projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descripción" error={errors.description?.message}>
        <input
          {...register("description")}
          aria-invalid={!!errors.description}
          placeholder="¿En qué trabajaste?"
        />
      </Field>
      <div className="form-row">
        <Field label="Fecha" error={errors.date?.message}>
          <input
            type="date"
            {...register("date")}
            aria-invalid={!!errors.date}
          />
        </Field>
        <Field label="Duración en minutos" error={errors.minutes?.message}>
          <input
            type="number"
            min="1"
            max="1440"
            {...register("minutes", { valueAsNumber: true })}
            aria-invalid={!!errors.minutes}
          />
        </Field>
      </div>
      <button className="button primary">Guardar horas</button>
    </form>
  );
}
function ExpenseForm({
  expense,
  onDone,
}: {
  expense?: Expense;
  onDone: () => void;
}) {
  const { state, update, notify } = useDemo();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseInput>({
    resolver: zodResolver(expenseInput),
    defaultValues: expense || {
      projectId: state.projects[0]?.id || "",
      date: today(),
      category: "Software",
      description: "",
      amount: 0,
    },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => {
        const amount = Math.round(values.amount * 100) / 100;
        if (amount <= 0) return;
        update((s) => ({
          ...s,
          expenses: expense
            ? s.expenses.map((e) =>
                e.id === expense.id ? { ...e, ...values, amount } : e,
              )
            : [...s.expenses, { ...values, amount, id: crypto.randomUUID() }],
        }));
        notify("Gasto guardado.");
        onDone();
      })}
    >
      <Field label="Proyecto" error={errors.projectId?.message}>
        <select {...register("projectId")}>
          {state.projects.map((p) => (
            <option value={p.id} key={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Descripción" error={errors.description?.message}>
        <input
          {...register("description")}
          aria-invalid={!!errors.description}
          placeholder="¿Qué adquiriste?"
        />
      </Field>
      <div className="form-row">
        <Field label="Importe en PEN" error={errors.amount?.message}>
          <input
            type="number"
            min="0.01"
            step="0.01"
            {...register("amount", { valueAsNumber: true })}
            aria-invalid={!!errors.amount}
          />
        </Field>
        <Field label="Fecha" error={errors.date?.message}>
          <input
            type="date"
            {...register("date")}
            aria-invalid={!!errors.date}
          />
        </Field>
      </div>
      <Field label="Categoría">
        <select {...register("category")}>
          <option>Software</option>
          <option>Equipo</option>
          <option>Servicios</option>
          <option>Otros</option>
        </select>
      </Field>
      <button className="button primary">Guardar gasto</button>
    </form>
  );
}
