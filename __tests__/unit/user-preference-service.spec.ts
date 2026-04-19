import { InMemoryUserPreferenceRepository } from "@tests/repositories/in-memory-user-preference-repository";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_USER_PREFERENCE } from "@/lib/domain/user-preference";
import { UserPreferenceService } from "@/lib/services/user-preference-service";

describe("UserPreferenceService", () => {
  let repo: InMemoryUserPreferenceRepository;
  let service: UserPreferenceService;

  beforeEach(() => {
    repo = new InMemoryUserPreferenceRepository();
    service = new UserPreferenceService(repo);
  });

  describe("getOrDefault", () => {
    it("should return defaults when no preference exists", async () => {
      const result = await service.getOrDefault("user-1");

      expect(result).toEqual(DEFAULT_USER_PREFERENCE);
    });

    it("should return stored preference when it exists", async () => {
      await repo.upsert("user-1", {
        theme: "dark",
        fontSize: "large",
        primaryColor: "green",
        favoritePage: "books",
      });

      const result = await service.getOrDefault("user-1");

      expect(result).toEqual({
        theme: "dark",
        fontSize: "large",
        primaryColor: "green",
        favoritePage: "books",
      });
    });
  });

  describe("updatePreference", () => {
    it("should create preference with defaults and apply partial update", async () => {
      const result = await service.updatePreference("user-1", { theme: "dark" });

      expect(result).toEqual({
        ...DEFAULT_USER_PREFERENCE,
        theme: "dark",
      });
    });

    it("should preserve existing fields when updating a single field", async () => {
      await service.updatePreference("user-1", { theme: "dark", primaryColor: "red" });
      const result = await service.updatePreference("user-1", { fontSize: "large" });

      expect(result).toEqual({
        theme: "dark",
        fontSize: "large",
        primaryColor: "red",
        favoritePage: "dashboard",
      });
    });

    it("should update multiple fields at once", async () => {
      const result = await service.updatePreference("user-1", {
        theme: "light",
        fontSize: "small",
        primaryColor: "red",
      });

      expect(result).toEqual({
        theme: "light",
        fontSize: "small",
        primaryColor: "red",
        favoritePage: "dashboard",
      });
    });
  });
});
