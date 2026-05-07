import type { ErrorCatalogEntry } from "./types";

export const platformCodes = {
  UNAUTHORIZED: {
    status: 401,
    message: "Sua sessão expirou. Faça login novamente.",
    variant: "warning",
  },
  VALIDATION_ERROR: {
    status: 422,
    message: "Os dados enviados são inválidos.",
  },
  INVALID_BODY: {
    status: 422,
    message: "Os dados enviados são inválidos.",
  },
  INTERNAL_ERROR: {
    status: 500,
    message: "Algo deu errado. Tente novamente em instantes.",
  },
  NETWORK_ERROR: {
    status: 0,
    message: "Verifique sua conexão e tente novamente.",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
