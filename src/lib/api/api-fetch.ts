import { toast } from "sonner";

import { navigateToLogin } from "@/components/features/auth/navigation-singleton";
import { type ErrorCode, errorCodes } from "@/lib/api/error-codes";

export type ApiResult<T> =
  | { readonly ok: true; readonly data: T; readonly headers: Headers }
  | { readonly ok: false; readonly kind: "session-expired" }
  | {
      readonly ok: false;
      readonly kind: "field-errors";
      readonly fields: Readonly<Record<string, string>>;
    }
  | {
      readonly ok: false;
      readonly kind: "api-error";
      readonly code: ErrorCode | string;
      readonly details?: unknown;
    }
  | { readonly ok: false; readonly kind: "network" };

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  readonly body?: unknown;
  readonly suppressToastFor?: ReadonlyArray<ErrorCode | string>;
}

interface ServerError {
  readonly code?: string;
  readonly message?: string;
  readonly details?: unknown;
}

interface ServerErrorEnvelope {
  readonly error?: ServerError;
}

const SESSION_TOAST_DEBOUNCE_MS = 1000;
let lastSessionToastAt = Number.NEGATIVE_INFINITY;

function dispatchSessionToast(message: string): void {
  const now = Date.now();
  if (now - lastSessionToastAt < SESSION_TOAST_DEBOUNCE_MS) return;
  lastSessionToastAt = now;
  toast.warning(message);
}

function dispatchToastForCode(code: string, message: string): void {
  const entry = (errorCodes as Record<string, { variant?: "error" | "warning" }>)[code];
  if (entry?.variant === "warning") {
    toast.warning(message);
  } else {
    toast.error(message);
  }
}

function fallbackMessage(code: string): string {
  const entry = (errorCodes as Record<string, { message: string }>)[code];
  return entry?.message ?? errorCodes.INTERNAL_ERROR.message;
}

function buildHeaders(options?: ApiFetchOptions): Headers {
  const headers = new Headers(options?.headers);
  if (!headers.has("accept")) headers.set("accept", "application/json");
  if (options?.body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return headers;
}

async function readErrorEnvelope(response: Response): Promise<ServerError | null> {
  try {
    const body = (await response.json()) as ServerErrorEnvelope;
    return body?.error ?? null;
  } catch {
    return null;
  }
}

function isFieldErrorList(
  details: unknown,
): details is ReadonlyArray<{ field: string; message: string }> {
  return (
    Array.isArray(details) &&
    details.every(
      (item): item is { field: string; message: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { field?: unknown }).field === "string" &&
        typeof (item as { message?: unknown }).message === "string",
    )
  );
}

export async function apiFetch<T = unknown>(
  url: string,
  options: ApiFetchOptions = {},
): Promise<ApiResult<T>> {
  const { body, suppressToastFor, headers: _headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    // Never follow redirects on an API call. An auth/edge layer that bounces an
    // unauthenticated request to /login (a 3xx) would otherwise be followed and
    // re-issue the original method against the page route (→ 405), defeating the
    // 401 handling below. "manual" surfaces the bounce so we can treat it as a
    // session expiry instead.
    redirect: "manual",
    headers: buildHeaders(options),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    toast.error(errorCodes.NETWORK_ERROR.message);
    return { ok: false, kind: "network" };
  }

  // A redirect on an API call means an auth/edge layer bounced us (e.g. the proxy
  // → /login for a missing session cookie). With redirect:"manual" the browser
  // surfaces this as an opaque redirect (type "opaqueredirect", status 0); other
  // runtimes expose the raw 3xx. Either way the session is gone — treat it like a 401.
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    dispatchSessionToast(errorCodes.UNAUTHORIZED.message);
    navigateToLogin();
    return { ok: false, kind: "session-expired" };
  }

  if (response.status === 204) {
    return { ok: true, data: null as T, headers: response.headers };
  }

  if (response.ok) {
    const data = (await response.json()) as T;
    return { ok: true, data, headers: response.headers };
  }

  const serverError = await readErrorEnvelope(response);
  const code = serverError?.code ?? "INTERNAL_ERROR";
  const message = serverError?.message ?? fallbackMessage(code);
  const details = serverError?.details;

  if (response.status === 401 || code === "UNAUTHORIZED") {
    dispatchSessionToast(errorCodes.UNAUTHORIZED.message);
    navigateToLogin();
    return { ok: false, kind: "session-expired" };
  }

  if (code === "VALIDATION_ERROR") {
    if (isFieldErrorList(details)) {
      const fields: Record<string, string> = {};
      for (const item of details) fields[item.field] = item.message;
      return { ok: false, kind: "field-errors", fields };
    }
    return { ok: false, kind: "api-error", code };
  }

  const isKnownCode = Object.hasOwn(errorCodes, code);
  if (!isKnownCode) {
    console.warn("apiFetch: unknown code", {
      code,
      requestId: response.headers.get("x-request-id"),
    });
  }

  const shouldToast = !(suppressToastFor?.includes(code) ?? false);
  if (shouldToast) {
    if (isKnownCode) {
      dispatchToastForCode(code, message);
    } else {
      toast.error(errorCodes.INTERNAL_ERROR.message);
    }
  }

  return {
    ok: false,
    kind: "api-error",
    code,
    ...(details !== undefined ? { details } : {}),
  };
}
