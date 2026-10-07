import { zodResolver } from "@hookform/resolvers/zod";
import { MEMBER_AREAS } from "@vexa/domain/member-admin";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { ErrorState } from "@/components/ui/ErrorState";
import { Field } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { areaLabel } from "@/lib/labels";
import { useInviteMember } from "../hooks/useMemberAdmin";
import { inviteSchema, type InviteFormValues } from "../schemas";

const defaults: InviteFormValues = { email: "", name: "", area: "technical", weeklyHours: 10, projectIds: [] };

function InviteForm({ onClose }: { onClose: () => void }) {
  const { register, control, handleSubmit, formState } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: defaults,
  });
  const projects = useProjects();
  const invite = useInviteMember();
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit((values) => invite.mutate({ ...values, role: "collaborator" }, { onSuccess: onClose }))}
    >
      <Field
        label="Correo"
        type="email"
        autoComplete="off"
        inputMode="email"
        error={formState.errors.email?.message}
        hint="Recibirá un enlace para elegir su contraseña."
        {...register("email")}
      />
      <Field label="Nombre" maxLength={80} error={formState.errors.name?.message} {...register("name")} />
      <Controller
        control={control}
        name="area"
        render={({ field }) => (
          <ChoicePicker
            label="Área o cargo"
            value={field.value}
            onChange={field.onChange}
            error={formState.errors.area?.message}
            options={MEMBER_AREAS.map((area) => ({ value: area, label: areaLabel[area] }))}
          />
        )}
      />
      <Field
        label="Horas por semana"
        type="number"
        inputMode="decimal"
        min={0}
        max={60}
        step="0.5"
        error={formState.errors.weeklyHours?.message}
        {...register("weeklyHours", { valueAsNumber: true })}
      />
      <Controller
        control={control}
        name="projectIds"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Proyectos a los que se une</legend>
            {projects.isError ? (
              <ErrorState message="No se pudieron cargar los proyectos." onRetry={() => projects.refetch()} />
            ) : projects.isLoading ? (
              <p className="text-sm text-muted">Cargando proyectos…</p>
            ) : (projects.data ?? []).length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay proyectos.</p>
            ) : (
              (projects.data ?? []).map((project) => (
                <label key={project.id} className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={field.value.includes(project.id)}
                    onChange={(e) =>
                      field.onChange(
                        e.target.checked
                          ? [...field.value, project.id]
                          : field.value.filter((id) => id !== project.id),
                      )
                    }
                  />
                  <span>{project.name}</span>
                </label>
              ))
            )}
            {formState.errors.projectIds?.message ? (
              <p className="mt-1 text-sm text-danger">{formState.errors.projectIds.message}</p>
            ) : null}
          </fieldset>
        )}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={invite.isPending}>
          {invite.isPending ? "Enviando…" : "Enviar invitación"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Invita a un colaborador por correo. Solo para administradores (devuelve `null` para el resto).
 * Los socios no se invitan aquí: entran tras una votación y un admin los promueve con `MemberAdminActions`.
 */
export function InviteCollaboratorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  if (user?.role !== "admin") return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invitar colaborador"
      description="Le llegará un correo para elegir su contraseña y entrar a Vexa Studio."
    >
      <InviteForm onClose={onClose} />
    </Sheet>
  );
}
