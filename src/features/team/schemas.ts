import { z } from 'zod'

export const dailySchema = z
  .object({
    done: z.string().trim().max(600, 'Máximo 600 caracteres'),
    willDo: z.string().trim().max(600, 'Máximo 600 caracteres'),
    blockers: z.string().trim().max(600, 'Máximo 600 caracteres'),
  })
  .refine((v) => v.done || v.willDo || v.blockers, { path: ['done'], message: 'Cuéntale algo al equipo' })
export type DailyFormValues = z.infer<typeof dailySchema>

export const announcementSchema = z.object({
  text: z.string().trim().min(1, 'Escribe el anuncio').max(500, 'Máximo 500 caracteres'),
})
export type AnnouncementFormValues = z.infer<typeof announcementSchema>

/** Horario de la convocatoria como lo entrega `datetime-local`: hora de Lima, sin zona. */
export const toLimaIso = (local: string) => new Date(`${local}:00-05:00`).toISOString()

export const proposeSchema = z
  .object({ slot1: z.string(), slot2: z.string(), slot3: z.string() })
  .superRefine((values, context) => {
    const filled = [values.slot1, values.slot2, values.slot3].filter(Boolean)
    if (filled.length < 2) {
      context.addIssue({ code: 'custom', path: ['slot2'], message: 'Propón al menos 2 horarios' })
    }
    if (new Set(filled).size !== filled.length) {
      context.addIssue({ code: 'custom', path: ['slot1'], message: 'Los horarios deben ser distintos' })
    }
    for (const key of ['slot1', 'slot2', 'slot3'] as const) {
      if (values[key] && new Date(toLimaIso(values[key])).getTime() <= Date.now()) {
        context.addIssue({ code: 'custom', path: [key], message: 'Elige un horario a futuro' })
      }
    }
  })
export type ProposeFormValues = z.infer<typeof proposeSchema>

export const confirmSchema = z.object({
  meetLink: z
    .string()
    .trim()
    .regex(/^https:\/\/\S+$/, 'Escribe el enlace completo, empieza con https://'),
})
export type ConfirmFormValues = z.infer<typeof confirmSchema>
