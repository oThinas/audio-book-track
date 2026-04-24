export const POSTGRES_UNIQUE_VIOLATION = "23505";

function extractCode(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const record = candidate as { code?: unknown };
  return typeof record.code === "string" ? record.code : null;
}

function extractConstraint(candidate: unknown): string | null {
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const record = candidate as { code?: unknown; constraint?: unknown };
  if (record.code !== POSTGRES_UNIQUE_VIOLATION) {
    return null;
  }
  return typeof record.constraint === "string" ? record.constraint : null;
}

function unwrap<T>(error: unknown, pick: (candidate: unknown) => T | null): T | null {
  const direct = pick(error);
  if (direct !== null) {
    return direct;
  }
  if (error instanceof Error && error.cause !== undefined) {
    return pick(error.cause);
  }
  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return unwrap(error, extractCode) === POSTGRES_UNIQUE_VIOLATION;
}

export function getUniqueConstraintName(error: unknown): string | null {
  return unwrap(error, extractConstraint);
}
