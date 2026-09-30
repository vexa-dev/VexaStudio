import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, X } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Field, SelectField } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import type { ExpenseCategory } from '@/domain/types'
import { expenseNeedsApproval } from '@/domain/rules'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { formatPen } from '@/lib/format'
import { fileToReceipt } from '@/lib/image'
import { expenseCategoryLabel } from '@/lib/labels'
import { useCreateExpense } from '../hooks/useExpenses'
import { expenseSchema, type ExpenseFormValues } from '../schemas'

const CATEGORIES = Object.keys(expenseCategoryLabel) as ExpenseCategory[]

function ExpenseForm({ onClose }: { onClose: () => void }) {
  const settings = useSettings()
  const create = useCreateExpense()
  const [receipt, setReceipt] = useState<string | null>(null)
  const [receiptError, setReceiptError] = useState<string | undefined>()

  const { register, handleSubmit, control, formState } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { amount: undefined, currency: 'PEN', concept: '', category: 'software', beforeSigning: false },
  })
  const amount = useWatch({ control, name: 'amount' })
  const currency = useWatch({ control, name: 'currency' })

  const needsVotes =
    settings.data !== undefined &&
    Number.isFinite(amount) &&
    (currency === 'USD' || expenseNeedsApproval(amount, settings.data))

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptError(undefined)
    try {
      setReceipt(await fileToReceipt(file))
    } catch (error) {
      setReceiptError(error instanceof Error ? error.message : 'No se pudo leer la imagen')
    }
  }

  const submit = handleSubmit(async (values) => {
    await create.mutateAsync({ ...values, receiptUrl: receipt })
    onClose()
  })

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field
          label="Monto"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          placeholder="0.00"
          autoFocus
          error={formState.errors.amount?.message}
          {...register('amount', { valueAsNumber: true })}
        />
        <SelectField label="Moneda" {...register('currency')}>
          <option value="PEN">S/ soles</option>
          <option value="USD">US$ dólares</option>
        </SelectField>
      </div>
      {needsVotes ? (
        <p role="status" className="-mt-2 rounded-lg bg-primary-soft px-3 py-2 text-sm text-primary-text">
          {currency === 'USD'
            ? 'Los gastos en dólares pasan por votación: necesitan 3 votos a favor.'
            : `Supera ${formatPen(settings.data?.expenseApprovalLimitPen ?? 0)}: quedará pendiente hasta tener 3 votos a favor.`}
        </p>
      ) : null}
      <Field label="Concepto" placeholder="Qué se pagó" error={formState.errors.concept?.message} {...register('concept')} />
      <SelectField label="Categoría" error={formState.errors.category?.message} {...register('category')}>
        {CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {expenseCategoryLabel[category]}
          </option>
        ))}
      </SelectField>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium" id="receipt-label">
          Comprobante
        </span>
        {receipt ? (
          <div className="flex items-center gap-3 rounded-lg border border-border p-2">
            <img src={receipt} alt="Vista previa del comprobante" className="size-16 rounded-md object-cover" />
            <p className="flex-1 text-sm text-muted">Foto lista para adjuntar.</p>
            <Button variant="ghost" className="w-11 px-0" aria-label="Quitar el comprobante" onClick={() => setReceipt(null)}>
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        ) : (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 text-sm text-muted focus-within:outline focus-within:outline-2 focus-within:outline-primary">
            <ImagePlus className="size-4" aria-hidden="true" />
            Tomar o elegir una foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-labelledby="receipt-label"
              className="sr-only"
              onChange={onFile}
            />
          </label>
        )}
        {receiptError ? <p className="text-sm text-danger">{receiptError}</p> : null}
      </div>

      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" className="size-5" {...register('beforeSigning')} />
        <span>
          Es previo a la firma del acuerdo <span className="text-muted">(no suma puntos)</span>
        </span>
      </label>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="submit" disabled={create.isPending}>
          Registrar gasto
        </Button>
      </div>
    </form>
  )
}

export function ExpenseFormSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Registrar gasto" description="Lo que pagaste por VEXA.">
      <ExpenseForm onClose={onClose} />
    </Sheet>
  )
}
