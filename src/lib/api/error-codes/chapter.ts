import type { ErrorCatalogEntry } from "./types";

export const chapterCodes = {
  CHAPTER_NOT_FOUND: {
    status: 404,
    message: "Capítulo não encontrado.",
  },
  CHAPTER_TITLE_INVALID: {
    status: 422,
    message: "Título do capítulo é obrigatório, com até 100 caracteres e sem quebras de linha.",
  },
  CHAPTER_POSITION_TARGET_INVALID: {
    status: 422,
    message: "Posição de inserção inválida.",
  },
  CHAPTERS_ORDER_MISMATCH: {
    status: 422,
    message: "A lista enviada não corresponde aos capítulos atuais do livro.",
  },
  CHAPTER_PAID_LOCKED: {
    status: 409,
    message:
      "Este capítulo já está pago — título, narrador, editor, duração e prazo não podem ser alterados.",
  },
  CHAPTER_INVALID_TRANSITION: {
    status: 422,
    message: "Transição de status não permitida para este capítulo.",
  },
  CHAPTER_NARRATOR_REQUIRED: {
    status: 422,
    message: "É preciso atribuir um narrador antes de iniciar a edição.",
  },
  CHAPTER_EDITOR_REQUIRED: {
    status: 422,
    message: "É preciso atribuir um editor antes de enviar para revisão.",
  },
  CHAPTER_EDITED_SECONDS_REQUIRED: {
    status: 422,
    message:
      "É preciso registrar a minutagem (tempo editado, acima de zero) antes de concluir o capítulo.",
  },
  CHAPTER_REVERSION_CONFIRMATION_REQUIRED: {
    status: 422,
    message: "Reverter de pago para concluído exige confirmação explícita.",
  },
  CHAPTERS_NOT_IN_BOOK: {
    status: 422,
    message: "Um ou mais capítulos não pertencem a este livro.",
  },
  CHAPTER_TITLE_ALREADY_IN_USE: {
    status: 409,
    message: "Já existe um capítulo com este título neste livro.",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
