import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { todayLima } from '@/lib/dates'
import { useCreateSprint } from '../hooks/useTasks'
import { sprintFormSchema, type SprintFormValues } from '../schemas'

/** Fecha `YYYY-MM-DD` a `days` días de hoy (Lima). Los sprints duran 2 semanas. */
const daysFromToday = (days: number) => todayLima(new Date(Date.now() + days * 24 * 60 * 60 * 1000))

function SprintForm({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const create = useCreateSprint()
  const { register, handleSubmit, formState } = useForm<SprintFormValues>({
    resolver: zodResolver(sprintFormSchema),
    defaultValues: { goal: '', startDate: daysFromToday(0), endDate: daysFromToday(13) },
  })
  const submit = handleSubmit(async (values) => {
    await create.mutateAsync({ projectId, ...values })
    onClose()
  })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field
        label="Objetivo"
        autoFocus
        placeholder="Qué queremos lograr en estas dos semanas"
        error={formState.errors.goal?.message}
        {...register('goal')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Inicio" type="date" error={formState.errors.startDate?.message} {...register('startDate')} />
        <Field label="Fin" type="date" error={formState.errors.endDate?.message} {...register('endDate')} />
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Crear sprint
        </Button>
      </div>
    </form>
  )
}

export function SprintFormSheet({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo sprint" description="Los sprints duran 2 semanas.">
      <SprintForm projectId={projectId} onClose={onClose} />
    </Sheet>
  )
}
