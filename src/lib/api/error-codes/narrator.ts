import type { ErrorCatalogEntry } from "./types";

export const narratorCodes = {
  NARRATOR_NOT_FOUND: {
    status: 404,
    message: "Narrador não encontrado.",
  },
  NARRATOR_REFERENCE_INVALID: {
    status: 422,
    message: "O narrador selecionado não existe ou está arquivado.",
  },
  NAME_ALREADY_IN_USE: {
    status: 409,
    message: "Já existe um cadastro com esse nome.",
  },
  NARRATOR_LINKED_TO_ACTIVE_CHAPTERS: {
    status: 409,
    message: "Este narrador está vinculado a capítulos ativos e não pode ser excluído.",
    variant: "warning",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
