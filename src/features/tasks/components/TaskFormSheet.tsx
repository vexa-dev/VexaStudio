import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import type { Task } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { CommentThread } from '@/features/comments/components/CommentThread'
import { useMembers } from '@/features/team/hooks/useMembers'
import { useCreateTask, useUpdateTask } from '../hooks/useTasks'
import { taskFormSchema, type TaskFormValues } from '../schemas'

interface TaskFormSheetProps {
  open: boolean
  onClose: () => void
  /** Proyecto y sprint donde se crea la tarea nueva. */
  projectId: string
  sprintId: string | null
  /** Tarea a editar; sin ella, se crea una nueva. */
  task?: Task
}

function TaskForm({ projectId, sprintId, task, onClose }: Omit<TaskFormSheetProps, 'open'>) {
  const { user } = useAuth()
  const members = useMembers()
  const create = useCreateTask()
  const update = useUpdateTask()

  const { register, handleSubmit, formState } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: task?.title ?? '',
      assigneeId: task ? (task.assigneeId ?? '') : (user?.id ?? ''),
      estimateHours: task?.estimateHours?.toString() ?? '',
      link: task?.link ?? '',
    },
  })

  const submit = handleSubmit(async (values) => {
    const fields = {
      title: values.title,
      assigneeId: values.assigneeId || null,
      estimateHours: values.estimateHours.trim() ? Number(values.estimateHours) : null,
      link: values.link || null,
    }
    if (task) await update.mutateAsync({ id: task.id, patch: fields })
    else await create.mutateAsync({ ...fields, projectId, sprintId })
    onClose()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Título" autoFocus error={formState.errors.title?.message} {...register('title')} />
      <SelectField label="Responsable" error={formState.errors.assigneeId?.message} {...register('assigneeId')}>
        <option value="">Sin responsable</option>
        {members.data?.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Estimación (h)"
          type="number"
          inputMode="decimal"
          step="0.5"
          min="0"
          placeholder="Opcional"
          error={formState.errors.estimateHours?.message}
          {...register('estimateHours')}
        />
        <Field
          label="Enlace"
          type="url"
          inputMode="url"
          placeholder="PR o entregable"
          error={formState.errors.link?.message}
          {...register('link')}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending || update.isPending}>
          {task ? 'Guardar cambios' : 'Crear tarea'}
        </Button>
      </div>
    </form>
  )
}

export function TaskFormSheet({ open, onClose, projectId, sprintId, task }: TaskFormSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={task ? 'Editar tarea' : 'Nueva tarea'}>
      <TaskForm projectId={projectId} sprintId={sprintId} task={task} onClose={onClose} />
      {task ? (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="mb-3 text-base font-semibold">Comentarios</h3>
          <CommentThread entity="task" entityId={task.id} />
        </div>
      ) : null}
    </Sheet>
  )
}
