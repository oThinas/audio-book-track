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
    narratorId: z.string().uuid("narratorId deve ser UUID válido").nullable().optional(),
    editorId: z.string().uuid("editorId deve ser UUID válido").nullable().optional(),
    editedSeconds: z
      .number({ error: "editedSeconds deve ser número" })
      .int("editedSeconds deve ser inteiro (segundos)")
      .min(EDITED_SECONDS_MIN, "editedSeconds não pode ser negativo")
      .max(EDITED_SECONDS_MAX, `editedSeconds deve ser no máximo ${EDITED_SECONDS_MAX}`)
      .optional(),
    confirmReversion: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Pelo menos um campo deve ser fornecido",
  });

export const bulkDeleteChaptersSchema = z.object({
  chapterIds: z
    .array(z.string().uuid("chapterId deve ser UUID válido"))
    .min(1, "Ao menos 1 capítulo deve ser informado")
    .max(BULK_DELETE_MAX, `Máximo de ${BULK_DELETE_MAX} capítulos por requisição`),
});

export const chapterIdParamsSchema = z.object({
  id: z.string().uuid("id deve ser UUID válido"),
});

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type BulkDeleteChaptersInput = z.infer<typeof bulkDeleteChaptersSchema>;
export type ChapterIdParams = z.infer<typeof chapterIdParamsSchema>;
