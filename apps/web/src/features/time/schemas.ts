import { z } from "zod";
import { MAX_PARTICIPANTS } from "@vexa/domain/hours-credit";

export const entrySchema = z.object({
  taskId: z.string(),
  projectId: z.string(),
  description: z
    .string()
    .trim()
    .min(8, "Describe brevemente el trabajo realizado (mínimo 8 caracteres)"),
  evidenceUrl: z
    .string()
    .trim()
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/i.test(v),
      "Usa un enlace http o https",
    ),
  startTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Indica la hora de inicio"),
  date: z.string().min(1, "Elige la fecha"),
  hours: z
    .number({ error: "Escribe las horas" })
    .positive("Las horas deben ser mayores a 0")
    .max(24, "Máximo 24 horas por registro"),
});
export type EntryFormValues = z.infer<typeof entrySchema>;

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Escribe el motivo de la anulación"),
});
export type VoidFormValues = z.infer<typeof voidSchema>;

/** People tagged on an entry. The owner never appears in the list and nobody repeats. */
export const participantsSchema = (ownerId: string) =>
  z
    .array(
      z.object({
        userId: z.string().min(1, "Elige a la persona"),
        sharePercent: z
          .number({ error: "Escribe el porcentaje" })
          .int("Usa un número entero")
          .min(1, "El mínimo es 1 %")
          .max(100, "El máximo es 100 %"),
      }),
    )
    .max(MAX_PARTICIPANTS, `Puedes etiquetar hasta ${MAX_PARTICIPANTS} personas`)
    .superRefine((list, ctx) => {
      const seen = new Set<string>();
      list.forEach((p, index) => {
        if (p.userId === ownerId)
          ctx.addIssue({
            code: "custom",
            path: [index, "userId"],
            message: "No puedes etiquetarte a ti mismo",
          });
        if (seen.has(p.userId))
          ctx.addIssue({
            code: "custom",
            path: [index, "userId"],
            message: "No repitas a una persona",
          });
        seen.add(p.userId);
      });
    });
export type ParticipantsValues = z.infer<ReturnType<typeof participantsSchema>>;
