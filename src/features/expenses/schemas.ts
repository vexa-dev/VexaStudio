import { z } from 'zod'

export const expenseSchema = z.object({
  amount: z
    .number({ error: 'Escribe el monto' })
    .positive('El monto debe ser mayor a 0')
    .max(1_000_000, 'Revisa el monto'),
  currency: z.enum(['PEN', 'USD']),
  concept: z.string().trim().min(3, 'Describe el gasto').max(120, 'Máximo 120 caracteres'),
  category: z.enum(['infrastructure', 'software', 'marketing', 'legal', 'other']),
  beforeSigning: z.boolean(),
})
export type ExpenseFormValues = z.infer<typeof expenseSchema>
