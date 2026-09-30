import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarPlus, ExternalLink, Video } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import { missedMeetingsInARow } from '@/domain/rules'
import type { Meeting, MeetingSlot, Profile, SlotVote } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { formatIsoDate, formatSlot } from '@/lib/dates'
import { cn, stagger } from '@/lib/utils'
import { useMembers } from '../hooks/useMembers'
import {
  useConfirmMeeting,
  useCurrentMeeting,
  useMarkAttendance,
  usePastMeetings,
  useProposeMeeting,
  useVoteSlot,
} from '../hooks/useTeam'
import {
  confirmSchema,
  proposeSchema,
  toLimaIso,
  type ConfirmFormValues,
  type ProposeFormValues,
} from '../schemas'

const names = (people: Profile[]) => people.map((p) => p.name.split(' ')[0]).join(', ')

function ProposeForm({ onClose }: { onClose: () => void }) {
  const propose = useProposeMeeting()
  const { register, handleSubmit, formState } = useForm<ProposeFormValues>({
    resolver: zodResolver(proposeSchema),
    defaultValues: { slot1: '', slot2: '', slot3: '' },
  })
  const submit = handleSubmit(async (values) => {
    const slots = [values.slot1, values.slot2, values.slot3].filter(Boolean).map(toLimaIso)
    await propose.mutateAsync(slots)
    onClose()
  })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">Propón 2 o 3 horarios (hora de Lima). Cada socio marcará en cuáles puede.</p>
      <Field label="Horario 1" type="datetime-local" error={formState.errors.slot1?.message} {...register('slot1')} />
      <Field label="Horario 2" type="datetime-local" error={formState.errors.slot2?.message} {...register('slot2')} />
      <Field label="Horario 3 (opcional)" type="datetime-local" error={formState.errors.slot3?.message} {...register('slot3')} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={propose.isPending}>
          Enviar convocatoria
        </Button>
      </div>
    </form>
  )
}

function ConfirmForm({ meeting, slot, onClose }: { meeting: Meeting; slot: MeetingSlot; onClose: () => void }) {
  const confirm = useConfirmMeeting()
  const { register, handleSubmit, formState } = useForm<ConfirmFormValues>({
    resolver: zodResolver(confirmSchema),
    defaultValues: { meetLink: '' },
  })
  const submit = handleSubmit(async ({ meetLink }) => {
    await confirm.mutateAsync({ meetingId: meeting.id, slotId: slot.id, meetLink })
    onClose()
  })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm">
        Se confirmará <span className="num font-semibold">{formatSlot(slot.startsAt)}</span>. Todos recibirán la fecha y
        el enlace.
      </p>
      <Field
        label="Enlace de Google Meet"
        type="url"
        inputMode="url"
        placeholder="https://meet.google.com/…"
        autoFocus
        error={formState.errors.meetLink?.message}
        {...register('meetLink')}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={confirm.isPending}>
          Confirmar reunión
        </Button>
      </div>
    </form>
  )
}

function AttendanceForm({ meeting, partners, onClose }: { meeting: Meeting; partners: Profile[]; onClose: () => void }) {
  const mark = useMarkAttendance()
  const [present, setPresent] = useState<Set<string>>(new Set(partners.map((p) => p.id)))
  const toggle = (id: string) =>
    setPresent((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col">
        <legend className="mb-1 text-sm text-muted">Marca a quienes asistieron.</legend>
        {partners.map((partner) => (
          <label key={partner.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={present.has(partner.id)}
              onChange={() => toggle(partner.id)}
            />
            {partner.name}
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={mark.isPending}
          onClick={async () => {
            await mark.mutateAsync({ meetingId: meeting.id, attendeeIds: [...present] })
            onClose()
          }}
        >
          Guardar asistencia
        </Button>
      </div>
    </div>
  )
}

interface SlotCardProps {
  slot: MeetingSlot
  votes: SlotVote[]
  partners: Profile[]
  myVote: boolean | undefined
  best: boolean
  isAdmin: boolean
  busy: boolean
  onVote: (available: boolean) => void
  onConfirm: () => void
}

function SlotCard({ slot, votes, partners, myVote, best, isAdmin, busy, onVote, onConfirm }: SlotCardProps) {
  const can = partners.filter((p) => votes.some((v) => v.userId === p.id && v.available))
  const cannot = partners.filter((p) => votes.some((v) => v.userId === p.id && !v.available))
  return (
    <Card className={cn('flex flex-col gap-3', best && 'border-primary')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="num text-base font-semibold">{formatSlot(slot.startsAt)}</h3>
        {best ? <Badge tone="primary">Más disponibilidad</Badge> : null}
      </div>
      <p className="text-sm text-muted">
        <span className="num font-semibold text-fg">{can.length}</span> de {partners.length} pueden
        {can.length > 0 ? `: ${names(can)}` : ''}
        {cannot.length > 0 ? `. No pueden: ${names(cannot)}` : ''}.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant={myVote === true ? 'primary' : 'secondary'} aria-pressed={myVote === true} disabled={busy} onClick={() => onVote(true)}>
          Puedo
        </Button>
        <Button variant={myVote === false ? 'primary' : 'secondary'} aria-pressed={myVote === false} disabled={busy} onClick={() => onVote(false)}>
          No puedo
        </Button>
      </div>
      {isAdmin ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={onConfirm}>
          Confirmar este horario
        </Button>
      ) : null}
    </Card>
  )
}

export function MeetingTab() {
  const { user } = useAuth()
  const members = useMembers()
  const current = useCurrentMeeting()
  const past = usePastMeetings()
  const vote = useVoteSlot()
  const [proposing, setProposing] = useState(false)
  const [confirming, setConfirming] = useState<MeetingSlot | null>(null)
  const [attending, setAttending] = useState(false)

  if (current.isError || past.isError) {
    return <ErrorState message="No se pudo cargar la reunión." onRetry={() => { void current.refetch(); void past.refetch() }} />
  }
  if (current.isLoading || past.isLoading || members.isLoading || !members.data || !past.data || !user) {
    return <Skeleton className="h-64" aria-busy="true" />
  }

  const partners = members.data.filter((m) => m.role !== 'collaborator')
  const isAdmin = user.role === 'admin'
  const detail = current.data
  const history = past.data.filter((m) => m.id !== detail?.meeting.id)
  const streaks = partners.filter((p) => missedMeetingsInARow(past.data, p.id) >= 2)

  const slotVotes = (slot: MeetingSlot) => detail?.votes.filter((v) => v.slotId === slot.id) ?? []
  const availability = (slot: MeetingSlot) => slotVotes(slot).filter((v) => v.available).length
  const top = detail ? Math.max(...detail.slots.map(availability)) : 0
  const answered = new Set(detail?.votes.map((v) => v.userId))
  const pendingAnswer = partners.filter((p) => !answered.has(p.id))
  const confirmedSlot = detail?.slots.find((s) => s.id === detail.meeting.confirmedSlotId)

  return (
    <div className="flex flex-col gap-6">
      {!detail ? (
        <EmptyState
          icon={CalendarPlus}
          title="Aún no hay convocatoria esta semana"
          description={
            isAdmin
              ? 'Propón 2 o 3 horarios y cada socio marcará en cuáles puede.'
              : 'El product owner propondrá los horarios y te avisaremos para que marques los tuyos.'
          }
          action={
            isAdmin ? (
              <Button onClick={() => setProposing(true)}>
                <CalendarPlus className="size-4" aria-hidden="true" />
                Convocar reunión
              </Button>
            ) : undefined
          }
        />
      ) : detail.meeting.status === 'polling' ? (
        <section aria-labelledby="convocatoria" className="enter flex flex-col gap-3" style={stagger(1)}>
          <div className="px-1">
            <h2 id="convocatoria" className="text-base font-semibold">
              Convocatoria de la semana
            </h2>
            <p className="text-sm text-muted">
              {pendingAnswer.length > 0 ? `Sin responder: ${names(pendingAnswer)}.` : 'Todos respondieron.'}
            </p>
          </div>
          {detail.slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              votes={slotVotes(slot)}
              partners={partners}
              myVote={slotVotes(slot).find((v) => v.userId === user.id)?.available}
              best={top > 0 && availability(slot) === top}
              isAdmin={isAdmin}
              busy={vote.isPending}
              onVote={(available) => vote.mutate({ slotId: slot.id, available })}
              onConfirm={() => setConfirming(slot)}
            />
          ))}
        </section>
      ) : (
        <section aria-labelledby="reunion" className="enter" style={stagger(1)}>
          <Card tone="accent" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="reunion" className="text-base font-semibold">
                Reunión de la semana
              </h2>
              <Badge tone={detail.meeting.status === 'held' ? 'success' : 'primary'}>
                {detail.meeting.status === 'held' ? 'Realizada' : 'Confirmada'}
              </Badge>
            </div>
            {confirmedSlot ? <p className="num text-lg font-bold">{formatSlot(confirmedSlot.startsAt)}</p> : null}
            {detail.meeting.status === 'held' ? (
              <p className="text-sm">
                Asistieron: {names(partners.filter((p) => detail.meeting.attendeeIds.includes(p.id))) || 'nadie'}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {detail.meeting.meetLink ? (
                  <a
                    href={detail.meeting.meetLink}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary-solid px-4 text-sm font-medium text-primary-fg"
                  >
                    <Video className="size-4" aria-hidden="true" />
                    Abrir Meet
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </a>
                ) : null}
                {isAdmin ? (
                  <Button variant="secondary" onClick={() => setAttending(true)}>
                    Marcar asistencia
                  </Button>
                ) : null}
              </div>
            )}
          </Card>
        </section>
      )}

      <section aria-labelledby="historial" className="enter flex flex-col gap-3" style={stagger(2)}>
        <h2 id="historial" className="px-1 text-sm font-semibold text-muted">
          Reuniones anteriores
        </h2>
        {history.length === 0 ? (
          <p className="px-1 text-sm text-muted">Todavía no hay reuniones registradas.</p>
        ) : (
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-border">
              {history.map((meeting) => (
                <li key={meeting.id} className="flex flex-col gap-1 px-4 py-3">
                  <p className="num text-sm font-semibold">Semana del {formatIsoDate(meeting.week)}</p>
                  <p className="text-sm text-muted">
                    Asistieron: {names(partners.filter((p) => meeting.attendeeIds.includes(p.id))) || 'nadie'}
                    {partners.some((p) => !meeting.attendeeIds.includes(p.id))
                      ? `. Faltaron: ${names(partners.filter((p) => !meeting.attendeeIds.includes(p.id)))}`
                      : ''}
                    .
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {streaks.length > 0 ? (
          <p className="px-1 text-sm text-muted">
            {names(streaks)} faltó a las últimas 2 reuniones. Según el acuerdo, dos ausencias seguidas cuentan como
            incumplimiento.
          </p>
        ) : null}
      </section>

      <Sheet open={proposing} onClose={() => setProposing(false)} title="Convocar reunión">
        <ProposeForm onClose={() => setProposing(false)} />
      </Sheet>
      <Sheet open={confirming !== null} onClose={() => setConfirming(null)} title="Confirmar horario">
        {detail && confirming ? <ConfirmForm meeting={detail.meeting} slot={confirming} onClose={() => setConfirming(null)} /> : null}
      </Sheet>
      <Sheet open={attending} onClose={() => setAttending(false)} title="Asistencia">
        {detail ? <AttendanceForm meeting={detail.meeting} partners={partners} onClose={() => setAttending(false)} /> : null}
      </Sheet>
    </div>
  )
}
