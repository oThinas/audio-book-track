import { describe, expect, it } from "vitest";

import { loginSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  describe("username", () => {
    it("should accept a valid username", () => {
      const result = loginSchema.safeParse({ username: "admin", password: "admin123" });
      expect(result.success).toBe(true);
    });

    it("should accept username with underscores and numbers", () => {
      const result = loginSchema.safeParse({ username: "user_123", password: "admin123" });
      expect(result.success).toBe(true);
    });

    it("should reject username shorter than 3 characters", () => {
      const result = loginSchema.safeParse({ username: "ab", password: "admin123" });
      expect(result.success).toBe(false);
    });

    it("should reject username longer than 30 characters", () => {
      const result = loginSchema.safeParse({
        username: "a".repeat(31),
        password: "admin123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject username with invalid characters (spaces)", () => {
      const result = loginSchema.safeParse({ username: "invalid user", password: "admin123" });
      expect(result.success).toBe(false);
    });

    it("should reject username with special characters", () => {
      const result = loginSchema.safeParse({ username: "user@name", password: "admin123" });
      expect(result.success).toBe(false);
    });

    it("should accept username with exactly 3 characters", () => {
      const result = loginSchema.safeParse({ username: "abc", password: "admin123" });
      expect(result.success).toBe(true);
    });

    it("should accept username with exactly 30 characters", () => {
      const result = loginSchema.safeParse({
        username: "a".repeat(30),
        password: "admin123",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("password", () => {
    it("should accept a valid password with 6+ characters", () => {
      const result = loginSchema.safeParse({ username: "admin", password: "123456" });
      expect(result.success).toBe(true);
    });

    it("should reject an empty password", () => {
      const result = loginSchema.safeParse({ username: "admin", password: "" });
      expect(result.success).toBe(false);
    });

    it("should reject a password shorter than 6 characters", () => {
      const result = loginSchema.safeParse({ username: "admin", password: "12345" });
      expect(result.success).toBe(false);
    });
  });
});
