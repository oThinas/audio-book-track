import { getTestDb } from "@tests/helpers/db";
import { createTestUser } from "@tests/helpers/factories";
import { describe, expect, it } from "vitest";
import { DrizzleUserPreferenceRepository } from "@/lib/repositories/drizzle/drizzle-user-preference-repository";

describe("UserPreferenceRepository", () => {
  function createRepo() {
    return new DrizzleUserPreferenceRepository(getTestDb());
  }

  describe("findByUserId", () => {
    it("should return null when no preference exists", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      const result = await repo.findByUserId(user.id);

      expect(result).toBeNull();
    });

    it("should return preference after upsert", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      await repo.upsert(user.id, { theme: "dark" });
      const result = await repo.findByUserId(user.id);

      expect(result).not.toBeNull();
      expect(result?.theme).toBe("dark");
      expect(result?.fontSize).toBe("medium");
      expect(result?.primaryColor).toBe("blue");
      expect(result?.favoritePage).toBe("dashboard");
    });
  });

  describe("upsert", () => {
    it("should create preference on first upsert", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      const result = await repo.upsert(user.id, { primaryColor: "green" });

      expect(result.primaryColor).toBe("green");
      expect(result.theme).toBe("system");
      expect(result.fontSize).toBe("medium");
      expect(result.favoritePage).toBe("dashboard");
    });

    it("should update existing preference on subsequent upsert", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      await repo.upsert(user.id, { theme: "dark" });
      const result = await repo.upsert(user.id, { fontSize: "large" });

      expect(result.theme).toBe("dark");
      expect(result.fontSize).toBe("large");
    });

    it("should update multiple fields at once", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      const result = await repo.upsert(user.id, {
        theme: "light",
        fontSize: "small",
        primaryColor: "red",
        favoritePage: "books",
      });

      expect(result.theme).toBe("light");
      expect(result.fontSize).toBe("small");
      expect(result.primaryColor).toBe("red");
      expect(result.favoritePage).toBe("books");
    });

    it("should return only preference fields (no id, no timestamps)", async () => {
      const repo = createRepo();
      const { user } = await createTestUser(getTestDb());

      const result = await repo.upsert(user.id, { theme: "dark" });

      const keys = Object.keys(result);
      expect(keys).toEqual(
        expect.arrayContaining(["theme", "fontSize", "primaryColor", "favoritePage"]),
      );
      expect(keys).not.toContain("id");
      expect(keys).not.toContain("userId");
      expect(keys).not.toContain("createdAt");
      expect(keys).not.toContain("updatedAt");
    });
  });

  describe("cascade delete", () => {
    it("should delete preference when user is deleted", async () => {
      const repo = createRepo();
      const db = getTestDb();
      const { user: testUser } = await createTestUser(db);

      await repo.upsert(testUser.id, { theme: "dark" });

      // Verify preference exists
      const before = await repo.findByUserId(testUser.id);
      expect(before).not.toBeNull();

      // Delete user — cascade should remove preference
      const { user: userTable } = await import("@/lib/db/schema");
      const { eq } = await import("drizzle-orm");
      await db.delete(userTable).where(eq(userTable.id, testUser.id));

      const after = await repo.findByUserId(testUser.id);
      expect(after).toBeNull();
    });
  });
});
