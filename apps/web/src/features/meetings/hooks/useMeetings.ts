import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Id, IsoDateTime } from "@vexa/domain/types";
import { services } from "@/services";

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Ocurrió un error inesperado";

const KEY = ["meeting", "current"] as const;

/** Convocatoria vigente (o `null`). Un colaborador no la consulta: RLS no le deja ver nada. */
export function useCurrentMeeting(enabled: boolean) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => services.meetings.getCurrent(),
    enabled,
  });
}

/** Convocar, votar, confirmar y marcar asistencia. Cada una refresca la convocatoria y los avisos. */
export function useMeetingActions() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meeting"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  const propose = useMutation({
    mutationFn: (slotStarts: IsoDateTime[]) => services.meetings.propose(slotStarts),
    onSuccess: () => {
      toast.success("Reunión convocada: el equipo ya puede votar");
      return refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const vote = useMutation({
    mutationFn: (input: { slotId: Id; available: boolean }) =>
      services.meetings.vote(input.slotId, input.available),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(messageOf(error)),
  });
  const confirm = useMutation({
    mutationFn: (input: { meetingId: Id; slotId: Id; meetLink: string }) =>
      services.meetings.confirm(input.meetingId, input.slotId, input.meetLink),
    onSuccess: () => {
      toast.success("Reunión confirmada y equipo avisado");
      return refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  const markAttendance = useMutation({
    mutationFn: (input: { meetingId: Id; attendeeIds: Id[] }) =>
      services.meetings.markAttendance(input.meetingId, input.attendeeIds),
    onSuccess: () => {
      toast.success("Asistencia registrada");
      return refresh();
    },
    onError: (error) => toast.error(messageOf(error)),
  });
  return { propose, vote, confirm, markAttendance };
}
