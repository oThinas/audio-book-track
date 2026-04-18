import { z } from "zod";

export interface Narrator {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const narratorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
});

export const createNarratorSchema = narratorFormSchema;
export const updateNarratorSchema = narratorFormSchema.partial();

export type NarratorFormValues = z.infer<typeof narratorFormSchema>;
export type CreateNarratorInput = z.infer<typeof createNarratorSchema>;
export type UpdateNarratorInput = z.infer<typeof updateNarratorSchema>;
