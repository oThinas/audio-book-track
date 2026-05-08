import { randomUUID } from "node:crypto";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function generateRequestId(): string {
  return randomUUID();
}

export function extractOrCreateRequestId(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  if (incoming && UUID_V4_REGEX.test(incoming)) {
    return incoming;
  }
  return generateRequestId();
}
