import { zodResolver } from '@hookform/resolvers/zod'
import { ListChecks } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextareaField } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { DailyUpdate, Profile } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { MentionText } from '@/features/comments/components/CommentThread'
import { MentionTextarea } from '@/features/comments/components/MentionTextarea'
import { formatDayHeading, todayLima } from '@/lib/dates'
import { stagger } from '@/lib/utils'
import { useDailies, useSubmitDaily, useSuggestDone } from '../hooks/useTeam'
import { useMembers } from '../hooks/useMembers'
import { dailySchema, type DailyFormValues } from '../schemas'

/** Lista de socios en una frase: "Rober, Diego y José". */
const joinNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} y ${names.at(-1)}`

function DailyForm({ today, members }: { today: DailyUpdate | undefined; members: Profile[] }) {
  const submit = useSubmitDaily()
  const suggest = useSuggestDone()
  const { register, control, handleSubmit, getValues, setValue, formState } = useForm<DailyFormValues>({
    resolver: zodResolver(dailySchema),
    defaultValues: { done: today?.done ?? '', willDo: today?.willDo ?? '', blockers: today?.blockers ?? '' },
  })

  const autofill = async () => {
    const lines = await suggest.mutateAsync()
    if (!lines) return
    const current = getValues('done').trim()
    setValue('done', current ? `${current}\n${lines}` : lines, { shouldDirty: true })
  }

  return (
    <form onSubmit={handleSubmit((values) => submit.mutateAsync(values))} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <TextareaField label="¿Qué hiciste?" error={formState.errors.done?.message} {...register('done')} />
        <Button variant="secondary" size="sm" className="self-start" disabled={suggest.isPending} onClick={autofill}>
          <ListChecks className="size-4" aria-hidden="true" />
          Autocompletar con mis tareas
        </Button>
      </div>
      <TextareaField label="¿Qué harás?" error={formState.errors.willDo?.message} {...register('willDo')} />
      <Controller
        control={control}
        name="blockers"
        render={({ field }) => (
          <MentionTextarea
            label="¿Qué te bloquea?"
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            members={members}
            rows={2}
            error={formState.errors.blockers?.message}
          />
        )}
      />
      <Button type="submit" className="self-end" disabled={submit.isPending}>
        {today ? 'Actualizar daily' : 'Enviar daily'}
      </Button>
    </form>
  )
}

function DailyEntry({ entry, author, members }: { entry: DailyUpdate; author: Profile | undefined; members: Profile[] }) {
  const fields = [
    { label: 'Hizo', text: entry.done },
    { label: 'Hará', text: entry.willDo },
    { label: 'Bloqueos', text: entry.blockers, mentions: true },
  ].filter((f) => f.text)
  return (
    <li className="flex flex-col gap-2 px-4 py-3.5">
      <p className="text-sm font-semibold">{author?.name ?? 'Un socio'}</p>
      <dl className="flex flex-col gap-1.5 text-sm">
        {fields.map((field) => (
          <div key={field.label} className="grid grid-cols-[4.5rem_1fr] gap-2">
            <dt className="text-muted">{field.label}</dt>
            <dd className="whitespace-pre-wrap break-words">
              {field.mentions ? <MentionText text={field.text} members={members} /> : field.text}
            </dd>
          </div>
        ))}
      </dl>
    </li>
  )
}

export function DailyTab() {
  const { user } = useAuth()
  const members = useMembers()
  const dailies = useDailies()
  const today = todayLima()

  if (dailies.isError) return <ErrorState message="No se pudieron cargar los daily." onRetry={() => dailies.refetch()} />
  if (dailies.isLoading || members.isLoading || !dailies.data || !members.data || !user) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-72" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  const partners = members.data.filter((m) => m.role !== 'collaborator')
  const mine = dailies.data.find((d) => d.userId === user.id && d.date === today)
  const missing = partners.filter((p) => !dailies.data.some((d) => d.userId === p.id && d.date === today))

  const days = [...new Set(dailies.data.map((d) => d.date))].sort().reverse().slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mi-daily" className="enter" style={stagger(1)}>
        <Card tone="raised" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="mi-daily" className="text-base font-semibold">
              Tu daily de hoy
            </h2>
            <p className="text-sm text-muted">
              {mine
                ? 'Ya lo enviaste. Puedes actualizarlo si algo cambió.'
                : 'Tres preguntas, un minuto. Los lunes, miércoles y viernes te lo recordamos a las 9:00 p. m.'}
            </p>
          </div>
          {/* La clave reinicia el formulario cuando llega el daily guardado. */}
          <DailyForm key={mine?.id ?? 'nuevo'} today={mine} members={partners} />
        </Card>
      </section>

      {missing.length > 0 ? (
        <p className="enter px-1 text-sm text-muted" style={stagger(2)}>
          Aún sin daily hoy: {joinNames(missing.map((m) => m.name.split(' ')[0]))}.
        </p>
      ) : null}

      <section aria-labelledby="ultimos" className="enter flex flex-col gap-4" style={stagger(3)}>
        <h2 id="ultimos" className="px-1 text-sm font-semibold text-muted">
          Últimos daily del equipo
        </h2>
        {days.length === 0 ? (
          <EmptyState icon={ListChecks} title="Aún no hay daily" description="Cuando alguien envíe el suyo, lo verás aquí." />
        ) : (
          days.map((day) => (
            <div key={day}>
              <h3 className="mb-2 px-1 text-sm font-semibold">{formatDayHeading(`${day}T12:00:00-05:00`)}</h3>
              <Card className="p-0 sm:p-0">
                <ul className="divide-y divide-border">
                  {dailies.data
                    .filter((d) => d.date === day)
                    .map((entry) => (
                      <DailyEntry
                        key={entry.id}
                        entry={entry}
                        author={members.data.find((m) => m.id === entry.userId)}
                        members={partners}
                      />
                    ))}
                </ul>
              </Card>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

