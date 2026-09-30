import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from './Button'
import { TextareaField } from './Field'
import { Sheet } from './Sheet'

const schema = z.object({ reason: z.string().trim().min(3, 'Escribe el motivo (al menos 3 caracteres)') })
type Values = z.infer<typeof schema>

interface ReasonSheetProps {
  open: boolean
  onClose: () => void
  title: string
  description: string
  label?: string
  placeholder?: string
  confirmLabel: string
  /** Acción destructiva: el botón de confirmar se pinta en rojo. */
  danger?: boolean
  pending?: boolean
  onConfirm: (reason: string) => Promise<unknown>
}

function ReasonForm({
  label = 'Motivo',
  placeholder,
  confirmLabel,
  danger,
  pending,
  description,
  onConfirm,
  onClose,
}: Omit<ReasonSheetProps, 'open' | 'title'>) {
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { reason: '' },
  })
  const submit = handleSubmit(async ({ reason }) => {
    await onConfirm(reason)
    onClose()
  })
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">{description}</p>
      <TextareaField
        label={label}
        placeholder={placeholder}
        error={formState.errors.reason?.message}
        {...register('reason')}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" variant={danger ? 'danger' : 'primary'} disabled={pending}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  )
}

/** Hoja que pide un motivo por escrito antes de una acción (anular, objetar…). */
export function ReasonSheet({ open, onClose, title, ...form }: ReasonSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <ReasonForm {...form} onClose={onClose} />
    </Sheet>
  )
}
