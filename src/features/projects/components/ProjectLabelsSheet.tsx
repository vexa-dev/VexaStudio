import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, Pencil, Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { ErrorState } from "@/components/ui/ErrorState";
import { labelInk } from "@/lib/label-color";
import { TaskLabels } from "@/features/tasks/components/TaskContent";
import { useProjectLabels, useSaveProjectLabel } from "../hooks/useProjects";
import type { ProjectLabel } from "@/domain/types";

const colors = [
  { name: "Verde", color: "#477860" },
  { name: "Azul", color: "#447298" },
  { name: "Ámbar", color: "#91673b" },
  { name: "Rosa", color: "#995557" },
  { name: "Violeta", color: "#78649b" },
  { name: "Turquesa", color: "#3a7f82" },
  { name: "Marrón", color: "#786c5d" },
  { name: "Gris", color: "#656d78" },
];
const schema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Escribe un nombre")
    .max(40, "Máximo 40 caracteres"),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i, "Usa un color hexadecimal, por ejemplo #447298"),
});
function LabelEditor({
  projectId,
  label,
  onSaved,
}: {
  projectId: string;
  label?: ProjectLabel;
  onSaved: () => void;
}) {
  const { register, control, handleSubmit, formState } = useForm<
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: label?.name ?? "",
      color: label?.color ?? colors[0].color,
    },
  });
  const save = useSaveProjectLabel(projectId);
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit((values) =>
        save.mutate({ ...values, id: label?.id }, { onSuccess: onSaved }),
      )}
    >
      <h3 className="text-sm font-semibold">
        {label ? "Editar etiqueta" : "Nueva etiqueta"}
      </h3>
      <Field
        label="Nombre de la etiqueta"
        maxLength={40}
        error={formState.errors.name?.message}
        {...register("name")}
      />
      <Controller
        control={control}
        name="color"
        render={({ field }) => (
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Color</legend>
            <div className="label-color-options">
              {colors.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className="label-color-option"
                  aria-label={c.name}
                  aria-pressed={field.value === c.color}
                  style={{ background: c.color, color: labelInk(c.color) }}
                  onClick={() => field.onChange(c.color)}
                >
                  {field.value === c.color && <Check size={18} />}
                </button>
              ))}
            </div>
            <Field
              label="Color personalizado"
              placeholder="#447298"
              error={formState.errors.color?.message}
              {...field}
            />
          </fieldset>
        )}
      />
      <div className="flex justify-end gap-2">
        {label && (
          <Button variant="secondary" onClick={onSaved}>
            Cancelar edición
          </Button>
        )}
        <Button type="submit" disabled={save.isPending}>
          {label ? "Guardar etiqueta" : "Crear etiqueta"}
        </Button>
      </div>
    </form>
  );
}
export function ProjectLabelsSheet({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const labels = useProjectLabels(projectId, open);
  const [editing, setEditing] = useState<ProjectLabel>();
  const [revision, setRevision] = useState(0);
  const reset = () => {
    setEditing(undefined);
    setRevision((v) => v + 1);
  };
  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Etiquetas del proyecto"
      description="Organiza las tareas con nombres y colores compartidos."
    >
      <div className="grid gap-5">
        {labels.isError ? (
          <ErrorState
            message="No se pudieron cargar las etiquetas."
            onRetry={() => labels.refetch()}
          />
        ) : labels.isLoading ? (
          <p className="text-sm text-muted">Cargando etiquetas…</p>
        ) : labels.data?.length ? (
          <ul className="grid gap-2">
            {labels.data.map((label) => (
              <li
                key={label.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-2"
              >
                <TaskLabels labels={[label]} />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar etiqueta ${label.name}`}
                  onClick={() => setEditing(label)}
                >
                  <Pencil size={15} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            Todavía no hay etiquetas en este proyecto.
          </p>
        )}
        {editing && (
          <Button variant="secondary" onClick={reset}>
            <Plus size={16} /> Nueva etiqueta
          </Button>
        )}
        <div className="border-t border-border pt-4">
          <LabelEditor
            key={`${editing?.id ?? "new"}-${revision}`}
            projectId={projectId}
            label={editing}
            onSaved={reset}
          />
        </div>
      </div>
    </Sheet>
  );
}
