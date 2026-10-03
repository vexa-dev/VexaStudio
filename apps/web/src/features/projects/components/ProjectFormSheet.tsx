import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useSaveProject } from "../hooks/useProjects";
import type { Project } from "@vexa/domain/types";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { useMembers } from "@/features/team/hooks/useMembers";

import { ChoicePicker } from "@/components/ui/ChoicePicker";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del proyecto"),
  type: z.enum(["internal", "product", "client"]),
  status: z.enum(["active", "paused", "archived"]),
});
function ProjectForm({
  project,
  onClose,
}: {
  project?: Project;
  onClose: () => void;
}) {
  const members = useMembers();
  const [ids, setIds] = useState(project?.memberIds ?? []);
  const { register, control, handleSubmit, formState } = useForm<
    z.infer<typeof schema>
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      name: project?.name ?? "",
      type: project?.type ?? "internal",
      status: project?.status ?? "active",
    },
  });
  const mutation = useSaveProject(project?.id);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) =>
        mutation.mutate({ ...values, memberIds: ids }, { onSuccess: onClose }),
      )}
    >
      <Field
        label="Nombre"
        error={formState.errors.name?.message}
        {...register("name")}
      />
      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ChoicePicker
              label="Tipo"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "internal", label: "Interno" },
                { value: "product", label: "Producto" },
                { value: "client", label: "Cliente" },
              ]}
            />
          )}
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <ChoicePicker
              label="Estado"
              value={field.value}
              onChange={field.onChange}
              options={[
                { value: "active", label: "Activo" },
                { value: "paused", label: "En pausa" },
                { value: "archived", label: "Archivado" },
              ]}
            />
          )}
        />
      </div>
      <fieldset>
        <legend className="mb-2 font-medium">Miembros del proyecto</legend>
        <p className="mb-2 text-xs text-muted">
          La asignación de una tarea no añade a la persona como miembro. Los
          administradores tienen acceso a todos los proyectos.
        </p>
        {members.data
          ?.filter((m) => m.active)
          .map((m) => (
            <label key={m.id} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={ids.includes(m.id)}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, m.id]
                      : ids.filter((id) => id !== m.id),
                  )
                }
                className="size-4 accent-primary"
              />
              <span>{m.name}</span>
            </label>
          ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          Guardar proyecto
        </Button>
      </div>
    </form>
  );
}
export function ProjectFormSheet({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project?: Project;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={project ? "Editar proyecto y miembros" : "Nuevo proyecto"}
    >
      <ProjectForm project={project} onClose={onClose} />
    </Sheet>
  );
}
