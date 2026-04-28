import { z } from "zod";

const TITLE_MAX = 255;
const PRICE_MIN_CENTS = 1;
const PRICE_MAX_CENTS = 999_999;
const NUM_CHAPTERS_MIN = 1;
const NUM_CHAPTERS_MAX = 999;

const titleSchema = z
  .string({ error: "Título é obrigatório" })
  .trim()
  .min(1, "Título é obrigatório")
  .max(TITLE_MAX, `Título deve ter no máximo ${TITLE_MAX} caracteres`);

const pricePerHourCentsSchema = z
  .number({ error: "Valor/hora é obrigatório" })
  .int("Valor/hora deve ser inteiro (centavos)")
  .min(PRICE_MIN_CENTS, "Valor/hora mínimo é R$ 0,01")
  .max(PRICE_MAX_CENTS, "Valor/hora máximo é R$ 9.999,99");

const numChaptersSchema = z
  .number({ error: "Número de capítulos é obrigatório" })
  .int("Número de capítulos deve ser inteiro")
  .min(NUM_CHAPTERS_MIN, "Deve haver pelo menos 1 capítulo")
  .max(NUM_CHAPTERS_MAX, `Máximo de ${NUM_CHAPTERS_MAX} capítulos`);

const PDF_URL_MAX = 2048;
// Espelha a CHECK constraint `book_pdf_url_format` (length ≤ 2048 + ^https?://)
const pdfUrlSchema = z
  .string()
  .trim()
  .max(PDF_URL_MAX, `URL deve ter no máximo ${PDF_URL_MAX} caracteres`)
  .regex(/^https?:\/\//i, "URL deve começar com http:// ou https://");

export const createBookSchema = z
  .object({
    title: titleSchema,
    studioId: z.string().uuid("studioId deve ser UUID válido"),
    pricePerHourCents: pricePerHourCentsSchema,
    numChapters: numChaptersSchema,
    inlineStudioId: z.string().uuid("inlineStudioId deve ser UUID válido").optional(),
  })
  .refine((data) => data.inlineStudioId === undefined || data.inlineStudioId === data.studioId, {
    message: "inlineStudioId must match studioId when provided",
    path: ["inlineStudioId"],
  });

export const updateBookSchema = z
  .object({
    title: titleSchema.optional(),
    studioId: z.string().uuid("studioId deve ser UUID válido").optional(),
    pricePerHourCents: pricePerHourCentsSchema.optional(),
    numChapters: numChaptersSchema.optional(),
    inlineStudioId: z.string().uuid("inlineStudioId deve ser UUID válido").optional(),
    // `null` → remove a URL. `undefined` → não altera. String válida → seta.
    pdfUrl: pdfUrlSchema.nullable().optional(),
  })
  .refine(
    (data) =>
      data.inlineStudioId === undefined ||
      (data.studioId !== undefined && data.inlineStudioId === data.studioId),
    {
      message: "inlineStudioId must match studioId when provided",
      path: ["inlineStudioId"],
    },
  )
  .refine(
    (data) =>
      Object.entries(data).some(([key, value]) => key !== "inlineStudioId" && value !== undefined),
    {
      message: "Pelo menos um campo deve ser fornecido",
    },
  );

export const bookIdParamsSchema = z.object({
  id: z.string().uuid("id deve ser UUID válido"),
});

export type CreateBookInput = z.infer<typeof createBookSchema>;
export type UpdateBookInput = z.infer<typeof updateBookSchema>;
export type BookIdParams = z.infer<typeof bookIdParamsSchema>;
