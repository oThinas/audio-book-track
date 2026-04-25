/**
 * Shared HTTP helpers for integration/route-handler tests. Keeps test
 * files free of duplicated request-builder boilerplate.
 */

export interface JsonRequestOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
}

/**
 * Build a `Request` with a JSON body (or a raw string for malformed-input
 * tests). Default method is `POST`. Use this for any test that hits a
 * Next.js route handler.
 */
export function jsonRequest(url: string, body: unknown, options: JsonRequestOptions = {}): Request {
  return new Request(url, {
    method: options.method ?? "POST",
    headers: { "content-type": "application/json", ...(options.headers ?? {}) },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
