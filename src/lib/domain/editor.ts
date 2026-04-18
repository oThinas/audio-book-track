import { z } from "zod";

export interface Editor {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export const editorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório")
    .max(255, "E-mail deve ter no máximo 255 caracteres")
    .email("E-mail inválido"),
});

export const createEditorSchema = editorFormSchema;
export const updateEditorSchema = editorFormSchema.partial();

export type EditorFormValues = z.infer<typeof editorFormSchema>;
export type CreateEditorInput = z.infer<typeof createEditorSchema>;
export type UpdateEditorInput = z.infer<typeof updateEditorSchema>;
