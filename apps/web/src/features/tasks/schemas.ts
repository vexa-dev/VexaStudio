import { z } from "zod";

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe el título de la tarea")
    .max(120, "Máximo 120 caracteres"),
  description: z.string().max(20000, "Máximo 20,000 caracteres"),
  assigneeId: z.string(),
  estimateHours: z
    .string()
    .refine(
      (v) => v.trim() === "" || (Number(v) > 0 && Number(v) <= 200),
      "Escribe un número de horas mayor a 0",
    ),
  link: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/.test(v),
      "Escribe un enlace que empiece con http:// o https://",
    ),
});
export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const sprintFormSchema = z
  .object({
    goal: z
      .string()
      .trim()
      .min(3, "Escribe el objetivo del sprint")
      .max(160, "Máximo 160 caracteres"),
    startDate: z.string().min(1, "Elige el inicio"),
    endDate: z.string().min(1, "Elige el fin"),
  })
  .refine((v) => v.endDate >= v.startDate, {
    path: ["endDate"],
    message: "El fin no puede ser anterior al inicio",
  });
export type SprintFormValues = z.infer<typeof sprintFormSchema>;
