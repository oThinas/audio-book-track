import type { ErrorCode } from "@/lib/api/error-codes";

/**
 * Base class for all domain errors that map to a stable API error code.
 *
 * Subclasses declare a literal `code` matching an entry in `errorCodes`. The
 * handler reads `code` to look up status/message/variant in the catalog —
 * no central registry to keep in sync.
 *
 * Subclasses may override `getDetails()` to expose structured data (e.g.
 * blocking book list) for inclusion in the response envelope's `details`.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;

  /** Override when the error carries structured data for the UI. */
  getDetails?(): unknown;
}
