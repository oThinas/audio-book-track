import type { ErrorCatalogEntry } from "./types";

export const bookCodes = {
  BOOK_NOT_FOUND: {
    status: 404,
    message: "Livro não encontrado.",
  },
  TITLE_ALREADY_IN_USE: {
    status: 409,
    message: "Já existe um livro com este título neste estúdio.",
  },
  INLINE_STUDIO_INVALID: {
    status: 422,
    message: "Os dados do novo estúdio são inválidos.",
  },
  BOOK_PAID_PRICE_LOCKED: {
    status: 409,
    message: "Este livro já possui um capítulo pago — o preço por hora não pode ser alterado.",
  },
  BOOK_PAID_STUDIO_LOCKED: {
    status: 409,
    message: "Este livro já possui um capítulo pago — o estúdio não pode ser alterado.",
  },
  BOOK_CANNOT_REDUCE_CHAPTERS: {
    status: 422,
    message: "Não é possível reduzir o número de capítulos abaixo do total atual.",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
