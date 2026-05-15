import { addYears, differenceInCalendarDays, parseISO } from "date-fns";
import { z } from "zod";

import { todayInAppTimezone } from "@/lib/domain/timezone";

const EDITED_SECONDS_MIN = 0;
const EDITED_SECONDS_MAX = 3_600_000;
const BULK_DELETE_MAX = 999;
const DEADLINE_MAX_YEARS_AHEAD = 10;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const chapterStatusSchema = z.enum([
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
]);

const CHAPTER_TITLE_MAX = 100;

export const chapterTitleSchema = z
  .string({ error: "Título é obrigatório." })
  .refine((s) => !/[\n\r]/.test(s), {
    message: "Título não pode ter quebras de linha.",
  })
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, { message: "Título é obrigatório." })
  .refine((s) => s.length <= CHAPTER_TITLE_MAX, {
    message: `Título deve ter no máximo ${CHAPTER_TITLE_MAX} caracteres.`,
  });

function isCalendarValid(iso: string): boolean {
  const date = parseISO(iso);
  if (Number.isNaN(date.getTime())) return false;
  const [year, month, day] = iso.split("-").map(Number);
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
  );
}

function isWithinTenYears(iso: string): boolean {
  const todayIso = todayInAppTimezone();
  const maxIsoDate = addYears(parseISO(todayIso), DEADLINE_MAX_YEARS_AHEAD);
  const deadline = parseISO(iso);
  return differenceInCalendarDays(deadline, maxIsoDate) <= 0;
}

const deadlineSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Data limite inválida (use formato AAAA-MM-DD).")
  .refine(isCalendarValid, { message: "Data limite inválida." })
  .refine(isWithinTenYears, {
    message: "Data limite não pode ser superior a 10 anos no futuro.",
  })
  .nullable();

export const updateChapterSchema = z
  .object({
    title: chapterTitleSchema.optional(),
    status: chapterStatusSchema.optional(),
    narratorId: z.uuid("Narrador inválido.").nullable().optional(),
    editorId: z.uuid("Editor inválido.").nullable().optional(),
    editedSeconds: z
      .number({ error: "Tempo editado deve ser um número." })
      .int("Tempo editado deve ser inteiro (em segundos).")
      .min(EDITED_SECONDS_MIN, "Tempo editado não pode ser negativo.")
      .max(EDITED_SECONDS_MAX, `Tempo editado deve ser no máximo ${EDITED_SECONDS_MAX} segundos.`)
      .optional(),
    deadline: deadlineSchema.optional(),
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

export const reorderChaptersSchema = z.object({
  orderedIds: z
    .array(z.uuid("Capítulo inválido."))
    .min(1, "Lista de capítulos não pode estar vazia.")
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "Lista de capítulos não pode conter duplicatas.",
    }),
  expectedVersion: z
    .number({ error: "Versão de capítulos é obrigatória." })
    .int("Versão deve ser um inteiro.")
    .nonnegative("Versão não pode ser negativa."),
});

export type ReorderChaptersInput = z.infer<typeof reorderChaptersSchema>;

export const chapterIdParamsSchema = z.object({
  id: z.uuid("Identificador inválido."),
});

export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type BulkDeleteChaptersInput = z.infer<typeof bulkDeleteChaptersSchema>;
export type ChapterIdParams = z.infer<typeof chapterIdParamsSchema>;
