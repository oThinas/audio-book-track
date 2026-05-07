import { describe, expect, it } from "vitest";

import { extractOrCreateRequestId, generateRequestId } from "@/lib/api/request-id";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateRequestId", () => {
  it("returns a UUID v4", () => {
    const id = generateRequestId();
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it("returns a different value on each call", () => {
    const a = generateRequestId();
    const b = generateRequestId();
    expect(a).not.toBe(b);
  });
});

describe("extractOrCreateRequestId", () => {
  it("echoes a valid UUID v4 from the X-Request-Id header", () => {
    const incoming = "11111111-1111-4111-8111-111111111111";
    const headers = new Headers({ "X-Request-Id": incoming });
    expect(extractOrCreateRequestId(headers)).toBe(incoming);
  });

  it("ignores invalid X-Request-Id values and generates a new UUID", () => {
    const headers = new Headers({ "X-Request-Id": "not-a-uuid" });
    const id = extractOrCreateRequestId(headers);
    expect(id).toMatch(UUID_V4_REGEX);
    expect(id).not.toBe("not-a-uuid");
  });

  it("generates a new UUID when no header is present", () => {
    const headers = new Headers();
    const id = extractOrCreateRequestId(headers);
    expect(id).toMatch(UUID_V4_REGEX);
  });

  it("is case-insensitive on the header name", () => {
    const incoming = "22222222-2222-4222-8222-222222222222";
    const headers = new Headers({ "x-request-id": incoming });
    expect(extractOrCreateRequestId(headers)).toBe(incoming);
  });
});
