import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("sidebar-constants", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("getSidebarCollapsed (server-side)", () => {
    it("should return false when cookie is not set", async () => {
      const { getSidebarCollapsed } = await import("@/components/layout/sidebar-constants");
      const result = getSidebarCollapsed(undefined);
      expect(result).toBe(false);
    });

    it("should return true when cookie value is 'true'", async () => {
      const { getSidebarCollapsed } = await import("@/components/layout/sidebar-constants");
      const result = getSidebarCollapsed("true");
      expect(result).toBe(true);
    });

    it("should return false when cookie value is 'false'", async () => {
      const { getSidebarCollapsed } = await import("@/components/layout/sidebar-constants");
      const result = getSidebarCollapsed("false");
      expect(result).toBe(false);
    });

    it("should return false for any non-'true' value", async () => {
      const { getSidebarCollapsed } = await import("@/components/layout/sidebar-constants");
      expect(getSidebarCollapsed("invalid")).toBe(false);
      expect(getSidebarCollapsed("")).toBe(false);
    });
  });

  describe("SIDEBAR_COOKIE_NAME", () => {
    it("should export the cookie name constant", async () => {
      const { SIDEBAR_COOKIE_NAME } = await import("@/components/layout/sidebar-constants");
      expect(SIDEBAR_COOKIE_NAME).toBe("sidebar-collapsed");
    });
  });
});
