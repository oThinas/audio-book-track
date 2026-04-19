import { describe, expect, it } from "vitest";

import {
  DEFAULT_USER_PREFERENCE,
  FAVORITE_PAGES,
  FONT_SIZES,
  favoritePageSchema,
  fontSizeSchema,
  PRIMARY_COLORS,
  primaryColorSchema,
  THEMES,
  themeSchema,
  updateUserPreferenceSchema,
} from "@/lib/domain/user-preference";

describe("User Preference Domain", () => {
  describe("defaults", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_USER_PREFERENCE).toEqual({
        theme: "system",
        fontSize: "medium",
        primaryColor: "blue",
        favoritePage: "dashboard",
      });
    });
  });

  describe("enum constants", () => {
    it("should have 3 themes", () => {
      expect(THEMES).toEqual(["light", "dark", "system"]);
    });

    it("should have 3 font sizes", () => {
      expect(FONT_SIZES).toEqual(["small", "medium", "large"]);
    });

    it("should have 5 primary colors", () => {
      expect(PRIMARY_COLORS).toEqual(["blue", "orange", "green", "red", "amber"]);
    });

    it("should have 6 favorite pages", () => {
      expect(FAVORITE_PAGES).toEqual([
        "dashboard",
        "books",
        "studios",
        "editors",
        "narrators",
        "settings",
      ]);
    });
  });

  describe("themeSchema", () => {
    it.each(["light", "dark", "system"] as const)("should accept '%s'", (value) => {
      expect(themeSchema.safeParse(value).success).toBe(true);
    });

    it("should reject invalid value", () => {
      expect(themeSchema.safeParse("auto").success).toBe(false);
    });
  });

  describe("fontSizeSchema", () => {
    it.each(["small", "medium", "large"] as const)("should accept '%s'", (value) => {
      expect(fontSizeSchema.safeParse(value).success).toBe(true);
    });

    it("should reject invalid value", () => {
      expect(fontSizeSchema.safeParse("xl").success).toBe(false);
    });
  });

  describe("primaryColorSchema", () => {
    it.each(["blue", "orange", "green", "red", "amber"] as const)("should accept '%s'", (value) => {
      expect(primaryColorSchema.safeParse(value).success).toBe(true);
    });

    it("should reject invalid value", () => {
      expect(primaryColorSchema.safeParse("purple").success).toBe(false);
    });
  });

  describe("favoritePageSchema", () => {
    it.each([
      "dashboard",
      "books",
      "studios",
      "editors",
      "narrators",
      "settings",
    ] as const)("should accept '%s'", (value) => {
      expect(favoritePageSchema.safeParse(value).success).toBe(true);
    });

    it("should reject invalid value", () => {
      expect(favoritePageSchema.safeParse("unknown-page").success).toBe(false);
    });
  });

  describe("updateUserPreferenceSchema", () => {
    it("should accept a single field update", () => {
      const result = updateUserPreferenceSchema.safeParse({ theme: "dark" });
      expect(result.success).toBe(true);
    });

    it("should accept multiple fields", () => {
      const result = updateUserPreferenceSchema.safeParse({
        theme: "light",
        fontSize: "large",
        primaryColor: "green",
      });
      expect(result.success).toBe(true);
    });

    it("should accept all fields", () => {
      const result = updateUserPreferenceSchema.safeParse({
        theme: "dark",
        fontSize: "small",
        primaryColor: "red",
        favoritePage: "books",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty object (no fields)", () => {
      const result = updateUserPreferenceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject invalid theme value", () => {
      const result = updateUserPreferenceSchema.safeParse({ theme: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid fontSize value", () => {
      const result = updateUserPreferenceSchema.safeParse({ fontSize: "huge" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid primaryColor value", () => {
      const result = updateUserPreferenceSchema.safeParse({ primaryColor: "pink" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid favoritePage value", () => {
      const result = updateUserPreferenceSchema.safeParse({ favoritePage: "unknown" });
      expect(result.success).toBe(false);
    });

    it("should strip unknown fields", () => {
      const result = updateUserPreferenceSchema.safeParse({
        theme: "dark",
        unknownField: "value",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ theme: "dark" });
        expect("unknownField" in result.data).toBe(false);
      }
    });
  });
});
