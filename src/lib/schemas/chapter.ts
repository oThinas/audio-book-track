import { z } from "zod";

const EDITED_SECONDS_MIN = 0;
const EDITED_SECONDS_MAX = 3_600_000;
const BULK_DELETE_MAX = 999;

const chapterStatusSchema = z.enum([
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
]);

export const updateChapterSchema = z
  .object({
    status: chapterStatusSchema.optional(),
    narratorId: z.uuid("Narrador inválido.").nullable().optional(),
    editorId: z.uuid("Editor inválido.").nullable().optional(),
    editedSeconds: z
      .number({ error: "Tempo editado deve ser um número." })
      .int("Tempo editado deve ser inteiro (em segundos).")
      .min(EDITED_SECONDS_MIN, "Tempo editado não pode ser negativo.")
      .max(EDITED_SECONDS_MAX, `Tempo editado deve ser no máximo ${EDITED_SECONDS_MAX} segundos.`)
      .optional(),
    confirmReversion: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser informado.",
  });

export const bulkDeleteChaptersSchema = z.object({
  chapterIds: z
    .array(z.uuid("Capítulo inválido."))
    .min(1, "Ao menos 1 capítulo deve ser informado.")
    .max(BULK_DELETE_MAX, `Máximo de ${BULK_DELETE_MAX} capítulos por requisição.`),
});

export const chapterIdParamsSchema = z.object({
  id: z.uuid("Identificador inválido."),
});

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type BulkDeleteChaptersInput = z.infer<typeof bulkDeleteChaptersSchema>;
export type ChapterIdParams = z.infer<typeof chapterIdParamsSchema>;
