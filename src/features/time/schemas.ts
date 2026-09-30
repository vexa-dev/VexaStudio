import { z } from 'zod'

export const entrySchema = z.object({
  taskId: z.string().min(1, 'Elige la tarea'),
  date: z.string().min(1, 'Elige la fecha'),
  hours: z
    .number({ error: 'Escribe las horas' })
    .positive('Las horas deben ser mayores a 0')
    .max(24, 'Máximo 24 horas por registro'),
})
export type EntryFormValues = z.infer<typeof entrySchema>
