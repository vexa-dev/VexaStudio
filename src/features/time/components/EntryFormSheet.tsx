import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import type { TimeEntry } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { todayLima } from '@/lib/dates'
import { useAddManualEntry, useUpdateEntry } from '../hooks/useTime'
import { entrySchema, type EntryFormValues } from '../schemas'

interface EntryFormSheetProps {
  open: boolean
  onClose: () => void
  /** Registro a editar; sin él, se crea uno nuevo. */
  entry?: TimeEntry
}

function EntryForm({ entry, onClose }: { entry?: TimeEntry; onClose: () => void }) {
  const { user } = useAuth()
  const tasks = useTasks()
  const projects = useProjects()
  const add = useAddManualEntry()
  const update = useUpdateEntry()

  const { register, handleSubmit, formState } = useForm<EntryFormValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      taskId: entry?.taskId ?? '',
      date: entry ? todayLima(new Date(entry.startedAt)) : todayLima(),
      hours: entry?.hours,
    },
  })

  const projectName = (id: string) => projects.data?.find((p) => p.id === id)?.name ?? ''
  const options = (tasks.data ?? []).filter((t) => t.sprintId !== null || t.id === entry?.taskId)
  const mine = options.filter((t) => t.assigneeId === user?.id)
  const others = options.filter((t) => t.assigneeId !== user?.id)
  const renderOption = (t: (typeof options)[number]) => (
    <option key={t.id} value={t.id}>
      {projectName(t.projectId)} · {t.title}
    </option>
  )

  const submit = handleSubmit(async ({ taskId, date, hours }) => {
    // Lima no tiene horario de verano (UTC-5): el mediodía de ese día es una hora segura.
    const startedAt = new Date(`${date}T12:00:00-05:00`).toISOString()
    if (entry) await update.mutateAsync({ id: entry.id, patch: { taskId, hours, startedAt } })
    else await add.mutateAsync({ taskId, date, hours })
    onClose()
  })

  const pending = add.isPending || update.isPending
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <SelectField label="Tarea" error={formState.errors.taskId?.message} {...register('taskId')}>
        <option value="">Elige una tarea…</option>
        {mine.length > 0 ? <optgroup label="Mis tareas">{mine.map(renderOption)}</optgroup> : null}
        {others.length > 0 ? <optgroup label="Otras tareas del sprint">{others.map(renderOption)}</optgroup> : null}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Fecha"
          type="date"
          max={todayLima()}
          error={formState.errors.date?.message}
          {...register('date')}
        />
        <Field
          label="Horas"
          type="number"
          inputMode="decimal"
          step="0.25"
          min="0"
          placeholder="1.5"
          error={formState.errors.hours?.message}
          {...register('hours', { valueAsNumber: true })}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {entry ? 'Guardar cambios' : 'Registrar horas'}
        </Button>
      </div>
    </form>
  )
}

export function EntryFormSheet({ open, onClose, entry }: EntryFormSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={entry ? 'Editar registro' : 'Registrar horas'}
      description={entry ? undefined : 'Para cuando olvidaste el temporizador.'}
    >
      <EntryForm entry={entry} onClose={onClose} />
    </Sheet>
  )
}
