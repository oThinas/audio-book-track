import { z } from "zod";

export interface Studio {
  readonly id: string;
  readonly name: string;
  readonly defaultHourlyRateCents: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const MIN_HOURLY_RATE_CENTS = 1;
const MAX_HOURLY_RATE_CENTS = 999_999;

export const studioSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  defaultHourlyRateCents: z
    .number({ error: "Valor/hora é obrigatório" })
    .int("Valor/hora deve ser inteiro (centavos)")
    .min(MIN_HOURLY_RATE_CENTS, "Valor/hora mínimo é R$ 0,01")
    .max(MAX_HOURLY_RATE_CENTS, "Valor/hora máximo é R$ 9.999,99"),
});

export const createStudioSchema = studioSchema;
export const updateStudioSchema = studioSchema.partial();

export const createStudioRequestSchema = studioSchema.extend({
  inline: z.literal(true).optional(),
});

export type CreateStudioInput = z.infer<typeof createStudioSchema>;
export type UpdateStudioInput = z.infer<typeof updateStudioSchema>;
export type CreateStudioRequest = z.infer<typeof createStudioRequestSchema>;

export const studioFormSchema = studioSchema;
export type StudioFormValues = z.infer<typeof studioFormSchema>;
