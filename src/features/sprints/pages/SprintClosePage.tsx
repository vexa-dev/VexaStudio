import { ArrowLeft, CircleCheck, Flag } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Meter } from '@/components/ui/Meter'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReasonSheet } from '@/components/ui/ReasonSheet'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import type { TimeEntry } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useActiveSprint, useProject, useTasks } from '@/features/tasks/hooks/useTasks'
import { useMembers } from '@/features/team/hooks/useMembers'
import { formatDate, formatIsoDate } from '@/lib/dates'
import { formatHours } from '@/lib/format'
import { useFirstPlay } from '@/lib/useFirstPlay'
import { stagger } from '@/lib/utils'
import { useCloseSprint, useObjectEntry, useSprintReview, useValidateEntries } from '../hooks/useSprintReview'

export default function SprintClosePage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const project = useProject(projectId)
  const sprint = useActiveSprint(projectId)
  const review = useSprintReview(sprint.data?.id)
  const tasks = useTasks({ sprintId: sprint.data?.id }, { enabled: Boolean(sprint.data) })
  const members = useMembers()
  const validate = useValidateEntries()
  const close = useCloseSprint()
  const objectEntry = useObjectEntry()
  const animate = useFirstPlay('sprint-close')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [objecting, setObjecting] = useState<TimeEntry | null>(null)
  const [confirmClose, setConfirmClose] = useState(false)

  const backLink = (
    <Link
      to={`/proyectos/${projectId}`}
      className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary-text"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      Tablero
    </Link>
  )

  if (project.isError || sprint.isError || review.isError) {
    return (
      <>
        {backLink}
        <ErrorState
          message="No se pudo cargar la revisión del sprint."
          onRetry={() => {
            void project.refetch()
            void sprint.refetch()
            void review.refetch()
          }}
        />
      </>
    )
  }
  if (project.isLoading || sprint.isLoading || (sprint.data && (review.isLoading || !review.data)) || !user) {
    return (
      <>
        {backLink}
        <Skeleton className="mb-6 h-16" />
        <Skeleton className="h-64" />
      </>
    )
  }
  if (!sprint.data || !review.data) {
    return (
      <>
        {backLink}
        <EmptyState
          icon={Flag}
          title="No hay un sprint activo para cerrar"
          description="Crea uno desde el tablero del proyecto."
        />
      </>
    )
  }

  const { members: reviews, entries, sprint: activeSprint } = review.data
  const memberOf = (id: string) => members.data?.find((m) => m.id === id)
  const taskTitle = (id: string) => tasks.data?.find((t) => t.id === id)?.title ?? 'Tarea'
  const isAdmin = user.role === 'admin'

  const toValidate = entries.filter((e) => e.userId !== user.id && !e.validated)
  const pendingByMember = reviews
    .filter((m) => m.userId !== user.id)
    .map((m) => ({ review: m, entries: toValidate.filter((e) => e.userId === m.userId) }))
    .filter((group) => group.entries.length > 0)
  const totalPending = entries.filter((e) => !e.validated).length
  const mine = reviews.find((m) => m.userId === user.id)

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const validateIds = async (ids: string[]) => {
    await validate.mutateAsync(ids)
    setSelected(new Set())
  }
  const selectedIds = toValidate.filter((e) => selected.has(e.id)).map((e) => e.id)

  return (
    <>
      {backLink}
      <PageHeader
        title="Cierre de sprint"
        description={`${activeSprint.goal} · ${formatIsoDate(activeSprint.startDate)} al ${formatIsoDate(activeSprint.endDate)}`}
      />

      <div className="flex flex-col gap-6">
        <section aria-labelledby="entregado" className="enter" style={stagger(1)}>
          <h2 id="entregado" className="mb-2 px-1 text-sm font-semibold text-muted">
            Comprometido y entregado
          </h2>
          <Card className="p-0 sm:p-0">
            <ul className="divide-y divide-border">
              {reviews.map((m) => {
                const person = memberOf(m.userId)
                return (
                  <li key={m.userId} className="flex flex-col gap-2.5 px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      {person ? <Avatar name={person.name} size="sm" /> : null}
                      <p className="flex-1 truncate text-sm font-medium">
                        {person?.name ?? 'Socio'}
                        {m.userId === user.id ? <span className="text-muted"> (tú)</span> : null}
                      </p>
                      <p className="num text-sm">
                        <span className="font-semibold">{m.tasksDone}</span> de {m.tasksAssigned} tareas
                      </p>
                    </div>
                    <Meter
                      value={m.doneEstimateHours}
                      max={Math.max(m.estimateHours, m.doneEstimateHours, 1)}
                      label={`${formatHours(m.doneEstimateHours)} entregadas de ${formatHours(m.estimateHours)} comprometidas`}
                      className="h-2"
                      animate={animate}
                    />
                    <p className="num text-xs text-muted">
                      {formatHours(m.doneEstimateHours)} entregadas de {formatHours(m.estimateHours)} estimadas ·{' '}
                      {formatHours(m.loggedHours)} registradas, {formatHours(m.validatedHours)} validadas
                    </p>
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>

        <section aria-labelledby="validar" className="enter" style={stagger(2)}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
            <h2 id="validar" className="text-sm font-semibold text-muted">
              Horas por validar
            </h2>
            {selectedIds.length > 0 ? (
              <Button size="sm" disabled={validate.isPending} onClick={() => validateIds(selectedIds)}>
                <CircleCheck className="size-4" aria-hidden="true" />
                Validar {selectedIds.length} seleccionadas
              </Button>
            ) : null}
          </div>

          {pendingByMember.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="No tienes horas por validar"
              description="Cuando el resto del equipo registre horas en este sprint, las revisarás aquí antes del cierre."
            />
          ) : (
            <div className="flex flex-col gap-4">
              {pendingByMember.map(({ review: m, entries: list }) => (
                <Card key={m.userId} className="p-0 sm:p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                    <p className="text-sm font-semibold">{memberOf(m.userId)?.name}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={validate.isPending}
                      onClick={() => validateIds(list.map((e) => e.id))}
                    >
                      Validar las {list.length}
                    </Button>
                  </div>
                  <ul className="divide-y divide-border">
                    {list.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-2 px-4 py-2">
                        <label className="flex min-h-11 flex-1 items-center gap-3 text-sm">
                          <input
                            type="checkbox"
                            className="size-5 shrink-0"
                            checked={selected.has(entry.id)}
                            onChange={() => toggle(entry.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 font-medium">{taskTitle(entry.taskId)}</span>
                            <span className="num text-xs text-muted">{formatDate(entry.startedAt)}</span>
                          </span>
                          <span className="num font-semibold">{formatHours(entry.hours)}</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Objetar el registro de ${taskTitle(entry.taskId)}`}
                          onClick={() => setObjecting(entry)}
                        >
                          Objetar
                        </Button>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </section>

        {mine ? (
          <p className="num enter px-1 text-sm text-muted" style={stagger(3)}>
            Tus horas en este sprint: {formatHours(mine.loggedHours)} registradas,{' '}
            <span className="font-semibold text-fg">{formatHours(mine.validatedHours)}</span> ya validadas por el equipo.
            Las validadas quedan bloqueadas y cuentan para tus puntos.
          </p>
        ) : null}

        <section aria-labelledby="cerrar" className="enter" style={stagger(4)}>
          <Card tone="accent" className="flex flex-col gap-3">
            <h2 id="cerrar" className="text-base font-semibold">
              Cerrar el sprint
            </h2>
            {totalPending > 0 ? (
              <p className="text-sm">
                Quedan <span className="num font-semibold">{totalPending}</span> registros sin validar. Las horas sin
                validar no suman puntos.
              </p>
            ) : (
              <p className="text-sm">Todas las horas del sprint están validadas.</p>
            )}
            {isAdmin ? (
              <Button className="self-start" onClick={() => setConfirmClose(true)}>
                <Flag className="size-4" aria-hidden="true" />
                Cerrar sprint
              </Button>
            ) : (
              <p className="text-sm text-muted">El cierre lo hace el product owner cuando el equipo termina de validar.</p>
            )}
          </Card>
        </section>
      </div>

      <ReasonSheet
        open={objecting !== null}
        onClose={() => setObjecting(null)}
        title="Objetar registro"
        description="Se abre un comentario en ese registro para que su dueño lo revise antes del cierre."
        label="Qué no cuadra"
        placeholder="Por ejemplo: ¿fueron 7 h en esta tarea?"
        confirmLabel="Enviar objeción"
        pending={objectEntry.isPending}
        onConfirm={(text) => (objecting ? objectEntry.mutateAsync({ entryId: objecting.id, text }) : Promise.resolve())}
      />

      <Sheet
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="¿Cerrar el sprint?"
        description={totalPending > 0 ? `Hay ${totalPending} registros sin validar.` : undefined}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Las horas validadas quedan bloqueadas y cuentan para los puntos. El proyecto se queda sin sprint activo
            hasta que crees el siguiente.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>
              Cancelar
            </Button>
            <Button
              disabled={close.isPending}
              onClick={async () => {
                await close.mutateAsync(activeSprint.id)
                setConfirmClose(false)
                navigate(`/proyectos/${projectId}`)
              }}
            >
              Cerrar sprint
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
