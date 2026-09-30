import { CalendarClock, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReasonSheet } from '@/components/ui/ReasonSheet'
import { Sheet } from '@/components/ui/Sheet'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Expense } from '@/domain/types'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useSettings } from '@/features/settings/hooks/useSettings'
import { useMembers } from '@/features/team/hooks/useMembers'
import { daysUntil, formatIsoDate } from '@/lib/dates'
import { formatMoney } from '@/lib/format'
import { useFirstPlay } from '@/lib/useFirstPlay'
import { cn, stagger } from '@/lib/utils'
import { ExpenseCard } from '../components/ExpenseCard'
import { ExpenseFormSheet } from '../components/ExpenseFormSheet'
import { useExpenseBoard, useVoidExpense, useVoteExpense } from '../hooks/useExpenses'

type Filter = 'to-vote' | 'all'

function renewalTone(days: number): 'warning' | 'primary' | 'neutral' {
  if (days <= 7) return 'warning'
  if (days <= 30) return 'primary'
  return 'neutral'
}

export default function ExpensesPage() {
  const { user } = useAuth()
  const board = useExpenseBoard()
  const members = useMembers()
  const settings = useSettings()
  const vote = useVoteExpense()
  const voidExpense = useVoidExpense()
  const animate = useFirstPlay('expenses')

  const [filter, setFilter] = useState<Filter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [receipt, setReceipt] = useState<Expense | null>(null)
  const [voiding, setVoiding] = useState<Expense | null>(null)

  const myVote = (expense: Expense) => board.data?.votes.get(expense.id)?.find((v) => v.userId === user?.id)?.inFavor
  const toVote = (board.data?.expenses ?? []).filter((e) => e.status === 'pending' && myVote(e) === undefined)
  const shown = filter === 'to-vote' ? toVote : (board.data?.expenses ?? [])
  const payerName = (id: string) => members.data?.find((m) => m.id === id)?.name ?? 'Un socio'

  return (
    <>
      <PageHeader
        title="Gastos"
        description="Lo que el equipo paga por VEXA. Los mayores al límite necesitan 3 votos a favor."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="size-4" aria-hidden="true" />
            Registrar gasto
          </Button>
        }
      />

      {board.isError ? (
        <ErrorState message="No se pudieron cargar los gastos." onRetry={() => board.refetch()} />
      ) : board.isLoading || !board.data || !settings.data ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <Skeleton className="h-11 max-w-xs" />
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {board.data.recurring.length > 0 ? (
            <section aria-labelledby="recurrentes" className="enter" style={stagger(1)}>
              <h2 id="recurrentes" className="mb-2 px-1 text-sm font-semibold text-muted">
                Gastos recurrentes
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {board.data.recurring.map((item) => {
                  const days = daysUntil(item.nextDate)
                  return (
                    <li key={item.id}>
                      <Card className="flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <CalendarClock className="size-5 text-primary-text" aria-hidden="true" />
                            <h3 className="text-base font-semibold">{item.concept}</h3>
                          </div>
                          <p className="num font-bold">{formatMoney(item.amount, item.currency)}</p>
                        </div>
                        <p className="num text-sm text-muted">
                          Renueva el {formatIsoDate(item.nextDate)} ·{' '}
                          {item.periodicity === 'yearly' ? 'cada año' : 'cada mes'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={renewalTone(days)}>
                            {days < 0 ? 'Vencido' : days === 0 ? 'Renueva hoy' : `Renueva en ${days} días`}
                          </Badge>
                          {item.beforeSigning ? <Badge>Previo a la firma: no suma puntos</Badge> : null}
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="gastos" className="enter" style={stagger(2)}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="gastos" className="px-1 text-sm font-semibold text-muted">
                Gastos
              </h2>
              <div className="flex gap-2">
                {(
                  [
                    ['all', 'Todos'],
                    ['to-vote', `Por votar · ${toVote.length}`],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                    className={cn(
                      'num min-h-11 rounded-full border px-4 text-sm font-medium',
                      filter === value
                        ? 'border-primary bg-primary-soft text-primary-text'
                        : 'border-border bg-surface text-muted',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title={filter === 'to-vote' ? 'No tienes gastos por votar' : 'Aún no hay gastos'}
                description={
                  filter === 'to-vote'
                    ? 'Cuando alguien registre un gasto mayor al límite, aparecerá aquí para tu voto.'
                    : 'Registra el primero con su comprobante para que el equipo lo apruebe.'
                }
                action={
                  filter === 'all' ? (
                    <Button onClick={() => setFormOpen(true)}>
                      <Plus className="size-4" aria-hidden="true" />
                      Registrar gasto
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul className="grid gap-3 md:grid-cols-2">
                {shown.map((expense) => (
                  <li key={expense.id}>
                    <ExpenseCard
                      expense={expense}
                      payerName={payerName(expense.paidBy)}
                      settings={settings.data}
                      votes={board.data.votes.get(expense.id)}
                      myVote={myVote(expense)}
                      isOwn={expense.paidBy === user?.id}
                      busy={vote.isPending}
                      animate={animate}
                      onVote={(inFavor) => vote.mutate({ id: expense.id, inFavor })}
                      onViewReceipt={() => setReceipt(expense)}
                      onVoid={() => setVoiding(expense)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <ExpenseFormSheet open={formOpen} onClose={() => setFormOpen(false)} />

      <Sheet open={receipt !== null} onClose={() => setReceipt(null)} title="Comprobante" description={receipt?.concept}>
        {receipt?.receiptUrl ? (
          <img src={receipt.receiptUrl} alt={`Comprobante de ${receipt.concept}`} className="w-full rounded-lg" />
        ) : null}
      </Sheet>

      <ReasonSheet
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Anular gasto"
        description="Nadie borra gastos: al anular, deja de contar para los puntos y queda en el historial con tu motivo."
        placeholder="Por ejemplo: lo pagó otra persona"
        confirmLabel="Anular gasto"
        danger
        pending={voidExpense.isPending}
        onConfirm={(reason) => (voiding ? voidExpense.mutateAsync({ id: voiding.id, reason }) : Promise.resolve())}
      />
    </>
  )
}
