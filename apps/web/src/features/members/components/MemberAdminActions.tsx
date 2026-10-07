import { zodResolver } from "@hookform/resolvers/zod";
import { roleConfirmationText } from "@vexa/domain/member-admin";
import type { Profile, Role } from "@vexa/domain/types";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { ChoicePicker } from "@/components/ui/ChoicePicker";
import { Field, TextareaField } from "@/components/ui/Field";
import { Sheet } from "@/components/ui/Sheet";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { roleLabel } from "@/lib/labels";
import { useSetMemberActive, useSetMemberRole } from "../hooks/useMemberAdmin";
import {
  deactivateSchema,
  roleChangeSchema,
  type DeactivateValues,
  type RoleChangeValues,
} from "../schemas";

const ROLES: Role[] = ["collaborator", "partner", "admin"];

function RoleForm({ member, onDone }: { member: Profile; onDone: () => void }) {
  const [role, setRole] = useState<Role>(member.role);
  const expected = roleConfirmationText(role);
  const change = useSetMemberRole();
  const { register, handleSubmit, formState } = useForm<RoleChangeValues>({
    // El texto esperado depende del rol elegido: el resolver se recrea con él.
    resolver: zodResolver(roleChangeSchema(expected)),
    defaultValues: { confirmation: "", note: "" },
  });
  return (
    <form
      key={role}
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit((values) =>
        change.mutate({ memberId: member.id, role, note: values.note || undefined }, { onSuccess: onDone }),
      )}
    >
      <ChoicePicker
        label="Rol nuevo"
        value={role}
        onChange={(value) => setRole(value as Role)}
        options={ROLES.map((r) => ({ value: r, label: roleLabel[r] }))}
      />
      <Field
        label={`Escribe ${expected} para confirmar`}
        autoComplete="off"
        error={formState.errors.confirmation?.message}
        hint="Los socios entran tras una votación del equipo; cambia el rol solo si ya se acordó."
        {...register("confirmation")}
      />
      <TextareaField
        label="Nota (opcional)"
        maxLength={280}
        error={formState.errors.note?.message}
        {...register("note")}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={change.isPending || role === member.role}>
          Cambiar rol
        </Button>
      </div>
    </form>
  );
}

function DeactivateForm({ member, onDone }: { member: Profile; onDone: () => void }) {
  const set = useSetMemberActive();
  const { register, handleSubmit, formState } = useForm<DeactivateValues>({
    resolver: zodResolver(deactivateSchema),
    defaultValues: { reason: "" },
  });
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={handleSubmit(({ reason }) =>
        set.mutate({ memberId: member.id, active: false, reason }, { onSuccess: onDone }),
      )}
    >
      <p className="text-sm text-muted">
        {member.name} perderá el acceso y se cerrarán sus sesiones. Su historial se conserva y puedes reactivar su acceso después.
      </p>
      <TextareaField
        label="Motivo"
        maxLength={280}
        error={formState.errors.reason?.message}
        {...register("reason")}
      />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button variant="danger" type="submit" disabled={set.isPending}>
          Desactivar
        </Button>
      </div>
    </form>
  );
}

type Dialog = "role" | "deactivate" | null;

/**
 * Acciones de administración sobre una persona del equipo: cambiar rol (con texto de confirmación),
 * desactivar (con motivo) y reactivar. Solo se muestra a un administrador y nunca sobre sí mismo.
 */
export function MemberAdminActions({ member }: { member: Profile }) {
  const { user } = useAuth();
  const [dialog, setDialog] = useState<Dialog>(null);
  const setActive = useSetMemberActive();
  if (user?.role !== "admin" || user.id === member.id) return null;
  const close = () => setDialog(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {member.active ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => setDialog("role")}>
              Cambiar rol
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDialog("deactivate")}>
              Desactivar
            </Button>
          </>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            disabled={setActive.isPending}
            onClick={() => setActive.mutate({ memberId: member.id, active: true })}
          >
            Reactivar
          </Button>
        )}
      </div>
      <Sheet
        open={dialog === "role"}
        onClose={close}
        title={`Cambiar rol de ${member.name}`}
        description={`Rol actual: ${roleLabel[member.role]}.`}
      >
        <RoleForm member={member} onDone={close} />
      </Sheet>
      <Sheet
        open={dialog === "deactivate"}
        onClose={close}
        title={`Desactivar a ${member.name}`}
        description="Escribe por qué; queda en el registro de actividad."
      >
        <DeactivateForm member={member} onDone={close} />
      </Sheet>
    </>
  );
}
