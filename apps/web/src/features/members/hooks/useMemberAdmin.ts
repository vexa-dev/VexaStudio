import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Role } from "@vexa/domain/types";
import type { InviteMemberInput } from "@vexa/services";
import { toast } from "sonner";
import { services } from "@/services";

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Todo lo que depende del equipo: lista, resumen de Equipo, proyectos (membresías) y tablero. */
function useRefreshTeam() {
  const query = useQueryClient();
  return () =>
    Promise.all([
      query.invalidateQueries({ queryKey: ["members"] }),
      query.invalidateQueries({ queryKey: ["team"] }),
      query.invalidateQueries({ queryKey: ["projects"] }),
      query.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
}

/** Servicio sin soporte (fuente de datos que no administra miembros): mensaje claro en vez de `undefined`. */
const unsupported = () => Promise.reject(new Error("Esta fuente de datos no administra miembros."));

export function useInviteMember() {
  const refresh = useRefreshTeam();
  return useMutation({
    mutationFn: (input: InviteMemberInput) => (services.members.invite ?? unsupported)(input),
    // onSettled: una invitación enviada con un fallo parcial (proyectos) también cambia el equipo.
    onSettled: refresh,
    onSuccess: (profile) =>
      toast.success(
        profile.pendingInvite && profile.email
          ? `Invitación enviada a ${profile.email}`
          : "Invitación enviada",
      ),
    onError: (error) => toast.error(messageOf(error, "No se pudo enviar la invitación")),
  });
}

export function useSetMemberRole() {
  const refresh = useRefreshTeam();
  return useMutation({
    mutationFn: (input: { memberId: string; role: Role; note?: string }) =>
      (services.members.setRole ?? unsupported)(input.memberId, input.role, input.note),
    onSuccess: async () => {
      await refresh();
      toast.success("Rol actualizado");
    },
    onError: (error) => toast.error(messageOf(error, "No se pudo cambiar el rol")),
  });
}

export function useSetMemberActive() {
  const refresh = useRefreshTeam();
  return useMutation({
    mutationFn: (input: { memberId: string; active: boolean; reason?: string }) =>
      (services.members.setActive ?? unsupported)(input.memberId, input.active, input.reason),
    // onSettled: si falla solo el cierre de sesiones, la persona ya quedó (des)activada.
    onSettled: refresh,
    onSuccess: (profile) => toast.success(profile.active ? "Persona reactivada" : "Persona desactivada"),
    onError: (error) => toast.error(messageOf(error, "No se pudo actualizar a la persona")),
  });
}
