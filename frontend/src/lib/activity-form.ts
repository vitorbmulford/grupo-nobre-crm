import { z } from "zod";

export const activityFormSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "WHATSAPP", "OTHER"]),
  description: z
    .string()
    .trim()
    .min(1, "Descreva a interação.")
    .max(2000, "Use até 2.000 caracteres."),
  occurredAt: z
    .string()
    .min(1, "Informe quando ocorreu.")
    .refine((value) => {
      const date = new Date(value);
      return Number.isFinite(date.getTime()) && date.getTime() <= Date.now();
    }, "A data não pode estar no futuro."),
});
export type ActivityFormValues = z.infer<typeof activityFormSchema>;

export function activityPayload(values: ActivityFormValues) {
  return {
    ...values,
    description: values.description.trim(),
    occurredAt: new Date(values.occurredAt).toISOString(),
  };
}
