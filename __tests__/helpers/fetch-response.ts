/**
 * Shared fetch-response builders for unit tests that mock `globalThis.fetch`.
 * Keeps spec files free of `new Response(JSON.stringify(...), { status, headers })`
 * boilerplate.
 */

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function emptyResponse(status: number): Response {
  return new Response(null, { status });
}
