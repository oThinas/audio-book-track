import type { ErrorCatalogEntry } from "./types";

export const editorCodes = {
  EDITOR_NOT_FOUND: {
    status: 404,
    message: "Editor não encontrado.",
  },
  EDITOR_REFERENCE_INVALID: {
    status: 422,
    message: "O editor selecionado não existe ou está arquivado.",
  },
  EMAIL_ALREADY_IN_USE: {
    status: 409,
    message: "Já existe um cadastro com esse e-mail.",
  },
  EDITOR_LINKED_TO_ACTIVE_CHAPTERS: {
    status: 409,
    message: "Este editor está vinculado a capítulos ativos e não pode ser excluído.",
    variant: "warning",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
