import type { ErrorCatalogEntry } from "./types";

export const studioCodes = {
  STUDIO_NOT_FOUND: {
    status: 404,
    message: "Estúdio não encontrado.",
  },
  STUDIO_REFERENCE_INVALID: {
    status: 422,
    message: "O estúdio selecionado não existe ou está arquivado.",
  },
  STUDIO_HAS_ACTIVE_BOOKS: {
    status: 409,
    message: "Este estúdio possui livros com capítulos ativos e não pode ser excluído.",
    variant: "warning",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
