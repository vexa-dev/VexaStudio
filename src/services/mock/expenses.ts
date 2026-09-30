import { extractMentions } from '@/domain/mentions'
import { resolveExpenseStatus } from '@/domain/rules'
import type { Comment, Expense } from '@/domain/types'
import type { CommentService, ExpenseService } from '../types'
import { audit, currentPartner, currentUser, newId, notify, votingPartners } from './context'
import { getDb, save } from './db'
import { delay } from './utils'

/**
 * Gastos y su aprobación. Hasta el límite (S/ 50) se aprueban solos; por encima, quedan pendientes hasta
 * tener 3 votos a favor y se rechazan cuando ya no pueden alcanzarlos. Cualquier socio vota, incluido
 * quien pagó (los 4 socios suman los "3 de 4" del acuerdo).
 */

function findExpense(id: string): Expense {
  const expense = getDb().expenses.find((e) => e.id === id)
  if (!expense) throw new Error('El gasto no existe')
  return expense
}

export const expenses: ExpenseService = {
  async list() {
    currentUser()
    return delay([...getDb().expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  },
  async create(input) {
    const user = currentPartner()
    const db = getDb()
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('El monto debe ser mayor a 0')
    if (!input.concept.trim()) throw new Error('Escribe el concepto del gasto')
    const expense: Expense = {
      id: newId('e'),
      paidBy: user.id,
      amount: Math.round(input.amount * 100) / 100,
      currency: input.currency,
      concept: input.concept.trim(),
      category: input.category,
      receiptUrl: input.receiptUrl,
      status: 'pending',
      reimbursed: false,
      beforeSigning: input.beforeSigning ?? false,
      createdAt: new Date().toISOString(),
      voidReason: null,
    }
    expense.status = resolveExpenseStatus(expense, [], db.settings, votingPartners().length)
    db.expenses.push(expense)
    audit('expenses', expense.id, 'create', null, expense, user.id)
    // Si necesita votos, se avisa a los demás socios.
    if (expense.status === 'pending') {
      for (const partner of votingPartners()) {
        if (partner.id !== user.id) notify(partner.id, 'expense_vote', { expenseId: expense.id })
      }
    }
    save()
    return delay(expense)
  },
  async listVotes(expenseId) {
    currentUser()
    return delay(getDb().expenseVotes.filter((v) => v.expenseId === expenseId))
  },
  async vote(expenseId, inFavor) {
    const user = currentPartner()
    const db = getDb()
    const expense = findExpense(expenseId)
    if (expense.status !== 'pending') throw new Error('Este gasto ya no está pendiente de votación')
    const existing = db.expenseVotes.find((v) => v.expenseId === expenseId && v.userId === user.id)
    if (existing) existing.inFavor = inFavor
    else db.expenseVotes.push({ expenseId, userId: user.id, inFavor })
    const before = { ...expense }
    const votes = db.expenseVotes.filter((v) => v.expenseId === expenseId)
    expense.status = resolveExpenseStatus(expense, votes, db.settings, votingPartners().length)
    audit('expenses', expense.id, 'update', before, { ...expense, vote: { userId: user.id, inFavor } }, user.id)
    // Al resolverse la votación, quien pagó recibe el resultado.
    if (expense.status !== 'pending' && expense.paidBy !== user.id) {
      notify(expense.paidBy, 'expense_result', { expenseId: expense.id, status: expense.status })
    }
    save()
    return delay(expense)
  },
  async void(id, reason) {
    const user = currentUser()
    const expense = findExpense(id)
    if (expense.paidBy !== user.id) throw new Error('Solo quien registró el gasto puede anularlo')
    if (expense.status === 'voided') throw new Error('El gasto ya está anulado')
    if (expense.reimbursed) throw new Error('No se puede anular un gasto reembolsado')
    if (reason.trim().length < 3) throw new Error('Escribe el motivo de la anulación')
    const before = { ...expense }
    expense.status = 'voided'
    expense.voidReason = reason.trim()
    audit('expenses', expense.id, 'void', before, expense, user.id)
    save()
    return delay(expense)
  },
  async listRecurring() {
    currentUser()
    return delay([...getDb().recurringExpenses].sort((a, b) => a.nextDate.localeCompare(b.nextDate)))
  },
}

/** Comentarios sobre tareas, gastos y horas. Las @menciones avisan a la persona mencionada. */
export const comments: CommentService = {
  async list(entity, entityId) {
    currentUser()
    return delay(
      getDb()
        .comments.filter((c) => c.entity === entity && c.entityId === entityId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    )
  },
  async add({ entity, entityId, text }) {
    const user = currentUser()
    if (!text.trim()) throw new Error('Escribe el comentario')
    const comment: Comment = {
      id: newId('c'),
      entity,
      entityId,
      userId: user.id,
      text: text.trim(),
      mentions: extractMentions(text, votingPartners()),
      createdAt: new Date().toISOString(),
    }
    getDb().comments.push(comment)
    // Para llevar al mencionado al tablero de la tarea, el aviso guarda su proyecto.
    const projectId = entity === 'task' ? (getDb().tasks.find((t) => t.id === entityId)?.projectId ?? '') : ''
    for (const id of comment.mentions) {
      if (id !== user.id) {
        notify(id, 'mention', { by: user.id, entity, entityId, projectId, excerpt: comment.text.slice(0, 80) })
      }
    }
    save()
    return delay(comment)
  },
}
