import { pt as ptLocale } from "zod/locales";
import type { $ZodErrorMap } from "zod/v4/core";

const ptDefault = ptLocale().localeError;

/**
 * Custom error map registered globally via `z.config({ customError })`.
 *
 * Strategy:
 * - Pre-pass overrides for the most user-facing default cases (missing field
 *   becomes "Campo obrigatório." instead of the verbose "Tipo inválido:
 *   esperado string, recebido undefined").
 * - Falls back to Zod's built-in PT locale for everything else (too_small,
 *   too_big, invalid_format, enum, etc.).
 *
 * Schema-level messages (the second argument to `.min()`, `.email()`, etc.)
 * always win — this map only fires when no message was provided at the
 * schema definition site.
 */
export const ptBrZodErrorMap: $ZodErrorMap = (issue) => {
  if (issue.code === "invalid_type" && (issue.input === undefined || issue.input === null)) {
    return "Campo obrigatório.";
  }

  return ptDefault(issue);
};
