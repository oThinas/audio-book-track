import { z } from "zod";

export interface Studio {
  readonly id: string;
  readonly name: string;
  readonly defaultHourlyRate: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const MIN_HOURLY_RATE = 0.01;
const MAX_HOURLY_RATE = 9999.99;
const DECIMAL_TOLERANCE = 1e-9;

export const studioFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  defaultHourlyRate: z
    .number({ error: "Valor/hora é obrigatório" })
    .min(MIN_HOURLY_RATE, "Valor/hora mínimo é R$ 0,01")
    .max(MAX_HOURLY_RATE, "Valor/hora máximo é R$ 9.999,99")
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < DECIMAL_TOLERANCE,
      "Valor/hora deve ter no máximo 2 casas decimais",
    ),
});

export const createStudioSchema = studioFormSchema;
export const updateStudioSchema = studioFormSchema.partial();

export type StudioFormValues = z.infer<typeof studioFormSchema>;
export type CreateStudioInput = z.infer<typeof createStudioSchema>;
export type UpdateStudioInput = z.infer<typeof updateStudioSchema>;
