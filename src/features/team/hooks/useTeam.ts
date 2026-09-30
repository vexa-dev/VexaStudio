import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { services, type NewDailyInput } from '@/services'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Ocurrió un error inesperado')

export function useDailies() {
  return useQuery({ queryKey: ['daily'], queryFn: () => services.daily.list() })
}

export function useSubmitDaily() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewDailyInput) => services.daily.submit(input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['daily'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ])
      toast.success('Daily enviado')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useSuggestDone() {
  return useMutation({
    mutationFn: () => services.daily.suggestDone(),
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useAnnouncements() {
  return useQuery({ queryKey: ['announcements'], queryFn: () => services.announcements.list() })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => services.announcements.create(text),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements'] })
      toast.success('Anuncio publicado')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function usePinAnnouncement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) => services.announcements.setPinned(id, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements'] }),
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useCurrentMeeting() {
  return useQuery({ queryKey: ['meetings', 'current'], queryFn: () => services.meetings.getCurrent() })
}

export function usePastMeetings() {
  return useQuery({ queryKey: ['meetings', 'past'], queryFn: () => services.meetings.listPast() })
}

/** Cualquier cambio en la convocatoria afecta a la reunión actual, al historial y a los avisos. */
function useRefreshMeetings() {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['meetings'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ])
}

export function useProposeMeeting() {
  const refresh = useRefreshMeetings()
  return useMutation({
    mutationFn: (slots: string[]) => services.meetings.propose(slots),
    onSuccess: async () => {
      await refresh()
      toast.success('Convocatoria enviada al equipo')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useVoteSlot() {
  const refresh = useRefreshMeetings()
  return useMutation({
    mutationFn: ({ slotId, available }: { slotId: string; available: boolean }) =>
      services.meetings.vote(slotId, available),
    onSuccess: () => refresh(),
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useConfirmMeeting() {
  const refresh = useRefreshMeetings()
  return useMutation({
    mutationFn: ({ meetingId, slotId, meetLink }: { meetingId: string; slotId: string; meetLink: string }) =>
      services.meetings.confirm(meetingId, slotId, meetLink),
    onSuccess: async () => {
      await refresh()
      toast.success('Reunión confirmada: todos recibieron la fecha y el enlace')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}

export function useMarkAttendance() {
  const refresh = useRefreshMeetings()
  return useMutation({
    mutationFn: ({ meetingId, attendeeIds }: { meetingId: string; attendeeIds: string[] }) =>
      services.meetings.markAttendance(meetingId, attendeeIds),
    onSuccess: async () => {
      await refresh()
      toast.success('Asistencia registrada')
    },
    onError: (error) => toast.error(messageOf(error)),
  })
}
