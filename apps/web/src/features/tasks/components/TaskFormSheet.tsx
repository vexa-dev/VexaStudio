import { zodResolver } from "@hookform/resolvers/zod";
import { useState, type CSSProperties } from "react";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { Eye, PencilLine } from "lucide-react";
import { Link } from "react-router-dom";
import { labelInk } from "@/lib/label-color";
import { TaskMarkdown } from "./TaskContent";
import { useProjectLabels } from "@/features/projects/hooks/useProjects";
import { Sheet } from "@/components/ui/Sheet";
import type { Task } from "@vexa/domain/types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { EntityHistoryToggle } from "@/features/activity/components/EntityHistory";
import { useMembers } from "@/features/team/hooks/useMembers";
import { useCreateTask, useUpdateTask } from "../hooks/useTasks";
import { taskFormSchema, type TaskFormValues } from "../schemas";

/** Grows the textarea to fit its content; CSS max-height caps it and scrolls. */
function growTextarea(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

interface TaskFormSheetProps {
  open: boolean;
  onClose: () => void;
  /** Proyecto y sprint donde se crea la tarea nueva. */
  projectId: string | null;
  sprintId: string | null;
  /** Tarea a editar; sin ella, se crea una nueva. */
  task?: Task;
}

function TaskForm({
  projectId,
  sprintId,
  task,
  onClose,
}: Omit<TaskFormSheetProps, "open">) {
  const { user } = useAuth();
  const projects = useProjects();
  const [chosenProject, setChosenProject] = useState(projectId ?? "");
  const labels = useProjectLabels(chosenProject, user?.role === "admin");
  const [selectedLabels, setSelectedLabels] = useState(task?.labels ?? []);
  const [preview, setPreview] = useState(false);
  const members = useMembers();
  const create = useCreateTask();
  const update = useUpdateTask();

  const { register, control, handleSubmit, formState } =
    useForm<TaskFormValues>({
      resolver: zodResolver(taskFormSchema),
      defaultValues: {
        title: task?.title ?? "",
        description: task?.description ?? "",
        assigneeId: task ? (task.assigneeId ?? "") : (user?.id ?? ""),
        estimateHours: task?.estimateHours?.toString() ?? "",
        link: task?.link ?? "",
      },
    });

  const submit = handleSubmit(async (values) => {
    const fields = {
      projectId: chosenProject || null,
      sprintId: chosenProject === projectId ? sprintId : null,
      title: values.title,
      description: values.description,
      labels: selectedLabels,
      assigneeId: values.assigneeId || null,
      estimateHours: values.estimateHours.trim()
        ? Number(values.estimateHours)
        : null,
      link: values.link || null,
    };
    try {
      if (task) await update.mutateAsync({ id: task.id, patch: fields });
      else await create.mutateAsync(fields);
      onClose();
    } catch {
      /* Mutation reports errors without closing the form. */
    }
  });

  return (
    <form onSubmit={submit} noValidate className="task-form">
      <div className="task-form-main">
        <Field
          label="Título"
          autoFocus
          error={formState.errors.title?.message}
          {...register("title")}
        />
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <div className="grid gap-1.5">
              <div className="task-description-head">
                <label
                  htmlFor="task-description"
                  className="text-sm font-medium"
                >
                  Descripción (opcional)
                </label>
                <button
                  type="button"
                  className="task-preview-toggle"
                  aria-pressed={preview}
                  onClick={() => setPreview(!preview)}
                >
                  {preview ? (
                    <PencilLine aria-hidden size={14} />
                  ) : (
                    <Eye aria-hidden size={14} />
                  )}
                  {preview ? "Editar" : "Vista previa"}
                </button>
              </div>
              <div className="task-description-editor">
                {preview ? (
                  <div className="task-description-preview">
                    {field.value.trim() ? (
                      <TaskMarkdown text={field.value} />
                    ) : (
                      <p className="text-sm text-muted">Sin descripción.</p>
                    )}
                  </div>
                ) : (
                  <textarea
                    id="task-description"
                    rows={2}
                    maxLength={20000}
                    placeholder="Descripción (opcional)"
                    {...field}
                    ref={(el) => {
                      field.ref(el);
                      if (el) growTextarea(el);
                    }}
                    aria-invalid={Boolean(formState.errors.description)}
                    onChange={(e) => {
                      field.onChange(e);
                      growTextarea(e.currentTarget);
                    }}
                  />
                )}
              </div>
              {formState.errors.description && (
                <p role="alert" className="text-sm text-danger">
                  {formState.errors.description.message}
                </p>
              )}
            </div>
          )}
        />
      </div>
      <aside className="task-form-meta" aria-label="Detalles de la tarea">
        <ChoicePicker
          label="Proyecto (opcional)"
          value={chosenProject}
          onChange={(value) => {
            setChosenProject(value);
            setSelectedLabels([]);
          }}
          options={[
            { value: "", label: "Sin proyecto" },
            ...(projects.data ?? []).map((p) => ({
              value: p.id,
              label: p.name,
            })),
          ]}
        />
        <Controller
          name="assigneeId"
          control={control}
          render={({ field }) => (
            <ChoicePicker
              label="Responsable"
              value={field.value}
              onChange={field.onChange}
              error={formState.errors.assigneeId?.message}
              options={[
                { value: "", label: "Sin responsable" },
                ...(members.data ?? []).map((m) => ({
                  value: m.id,
                  label: m.name,
                })),
              ]}
            />
          )}
        />
        <Field
          label="Estimación (h)"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          error={formState.errors.estimateHours?.message}
          {...register("estimateHours")}
        />
        <Field
          label="Enlace"
          type="url"
          inputMode="url"
          placeholder="https://"
          error={formState.errors.link?.message}
          {...register("link")}
        />
        <fieldset className="task-form-wide grid gap-2">
          <legend className="mb-2 text-sm font-medium">Etiquetas</legend>
          {!chosenProject ? (
            <p className="text-sm text-muted">
              Elige un proyecto para asignar sus etiquetas.
            </p>
          ) : labels.isLoading ? (
            <p className="text-sm text-muted">Cargando etiquetas…</p>
          ) : labels.isError ? (
            <p role="alert" className="text-sm text-danger">
              No se pudieron cargar las etiquetas.{" "}
              <button
                type="button"
                onClick={() => labels.refetch()}
                className="underline"
              >
                Reintentar
              </button>
            </p>
          ) : labels.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {labels.data.map((label) => {
                const selected = selectedLabels.some((l) => l.id === label.id);
                return (
                  <button
                    key={label.id}
                    type="button"
                    className="task-label-choice"
                    aria-pressed={selected}
                    style={
                      {
                        "--label-color": label.color,
                        "--label-ink": labelInk(label.color),
                      } as CSSProperties
                    }
                    onClick={() =>
                      setSelectedLabels(
                        selected
                          ? selectedLabels.filter((l) => l.id !== label.id)
                          : [...selectedLabels, label],
                      )
                    }
                  >
                    {label.name}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Este proyecto aún no tiene etiquetas.
            </p>
          )}
          {chosenProject && (
            <Link
              className="text-xs text-primary-text underline"
              to={`/proyectos/${chosenProject}`}
              onClick={onClose}
            >
              Gestionar etiquetas en el proyecto ↗
            </Link>
          )}
        </fieldset>
        {task ? (
          <div className="task-form-wide">
            <EntityHistoryToggle table="tasks" id={task.id} />
          </div>
        ) : null}
      </aside>
      <div className="task-form-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {task ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </div>
    </form>
  );
}

export function TaskFormSheet({
  open,
  onClose,
  projectId,
  sprintId,
  task,
}: TaskFormSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? "Editar tarea" : "Nueva tarea"}
      className="task-sheet"
    >
      <TaskForm
        projectId={projectId}
        sprintId={sprintId}
        task={task}
        onClose={onClose}
      />
    </Sheet>
  );
}
