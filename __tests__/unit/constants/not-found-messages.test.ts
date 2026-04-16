import { describe, expect, it } from "vitest";
import { NOT_FOUND_MESSAGES } from "@/lib/constants/not-found-messages";

describe("NOT_FOUND_MESSAGES", () => {
  it("contains at least 5 messages", () => {
    expect(NOT_FOUND_MESSAGES.length).toBeGreaterThanOrEqual(5);
  });

  it("contains only non-empty strings", () => {
    for (const message of NOT_FOUND_MESSAGES) {
      expect(typeof message).toBe("string");
      expect(message.trim().length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate messages", () => {
    const unique = new Set(NOT_FOUND_MESSAGES);
    expect(unique.size).toBe(NOT_FOUND_MESSAGES.length);
  });
});
