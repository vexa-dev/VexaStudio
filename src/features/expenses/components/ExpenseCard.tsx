import { Ban, FileImage, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Meter } from '@/components/ui/Meter'
import { EXPENSE_VOTES_REQUIRED, expensePoints } from '@/domain/rules'
import type { Expense, ExpenseStatus, ExpenseVote, Settings } from '@/domain/types'
import { formatDate } from '@/lib/dates'
import { formatInt, formatMoney } from '@/lib/format'
import { expenseCategoryLabel, expenseStatusLabel } from '@/lib/labels'

const statusTone: Record<ExpenseStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  voided: 'neutral',
}

interface ExpenseCardProps {
  expense: Expense
  payerName: string
  settings: Settings
  /** Votos del gasto, solo cuando está pendiente. */
  votes?: ExpenseVote[]
  /** Voto de la persona que mira, si ya votó. */
  myVote?: boolean
  isOwn: boolean
  busy?: boolean
  animate?: boolean
  onVote: (inFavor: boolean) => void
  onViewReceipt: () => void
  onVoid: () => void
}

export function ExpenseCard({
  expense,
  payerName,
  settings,
  votes,
  myVote,
  isOwn,
  busy,
  animate,
  onVote,
  onViewReceipt,
  onVoid,
}: ExpenseCardProps) {
  const inFavor = votes?.filter((v) => v.inFavor).length ?? 0
  const against = (votes?.length ?? 0) - inFavor
  const points = expensePoints(expense, settings)
  const voided = expense.status === 'voided'

  return (
    <Card tone="raised" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className={`text-base font-semibold ${voided ? 'text-muted line-through' : ''}`}>{expense.concept}</h3>
          <p className="mt-0.5 text-xs text-muted">
            {payerName} · {formatDate(expense.createdAt)} · {expenseCategoryLabel[expense.category]}
          </p>
        </div>
        <p className="num shrink-0 text-lg font-bold">{formatMoney(expense.amount, expense.currency)}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone[expense.status]}>{expenseStatusLabel[expense.status]}</Badge>
        {expense.beforeSigning ? <Badge>Previo a la firma</Badge> : null}
        {expense.reimbursed ? <Badge>Reembolsado</Badge> : null}
      </div>

      {expense.status === 'approved' ? (
        <p className="num text-sm text-muted">
          {points > 0
            ? `Suma ${formatInt(points)} puntos a ${payerName.split(' ')[0]}.`
            : 'No suma puntos'}
          {points === 0 && expense.beforeSigning ? ' (previo a la firma).' : null}
          {points === 0 && expense.reimbursed ? ' (fue reembolsado).' : null}
          {points === 0 && expense.currency !== 'PEN' ? ' (solo cuentan los gastos en soles).' : null}
        </p>
      ) : null}
      {voided && expense.voidReason ? <p className="text-sm text-muted">Motivo: {expense.voidReason}</p> : null}

      {expense.status === 'pending' ? (
        <div className="flex flex-col gap-3 rounded-lg bg-surface-2 p-3">
          <div className="flex flex-col gap-1.5">
            <p className="num text-sm">
              <span className="font-semibold">{inFavor}</span> de {EXPENSE_VOTES_REQUIRED} votos a favor
              {against > 0 ? <span className="text-muted"> · {against} en contra</span> : null}
            </p>
            <Meter
              value={inFavor}
              max={EXPENSE_VOTES_REQUIRED}
              label={`${inFavor} de ${EXPENSE_VOTES_REQUIRED} votos a favor`}
              className="h-2"
              animate={animate}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={myVote === true ? 'primary' : 'secondary'}
              aria-pressed={myVote === true}
              disabled={busy}
              onClick={() => onVote(true)}
            >
              <ThumbsUp className="size-4" aria-hidden="true" />
              A favor
            </Button>
            <Button
              variant={myVote === false ? 'danger' : 'secondary'}
              aria-pressed={myVote === false}
              disabled={busy}
              onClick={() => onVote(false)}
            >
              <ThumbsDown className="size-4" aria-hidden="true" />
              En contra
            </Button>
          </div>
        </div>
      ) : null}

      {expense.receiptUrl || (isOwn && !voided && !expense.reimbursed) ? (
        <div className="flex flex-wrap gap-2">
          {expense.receiptUrl ? (
            <Button variant="ghost" size="sm" onClick={onViewReceipt}>
              <FileImage className="size-4" aria-hidden="true" />
              Ver comprobante
            </Button>
          ) : null}
          {isOwn && !voided && !expense.reimbursed ? (
            <Button variant="ghost" size="sm" onClick={onVoid}>
              <Ban className="size-4" aria-hidden="true" />
              Anular
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  )
}
