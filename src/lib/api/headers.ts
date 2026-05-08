export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function requestIdHeader(id: string): Record<string, string> {
  return { "X-Request-Id": id };
}
