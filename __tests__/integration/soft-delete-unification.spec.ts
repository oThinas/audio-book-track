import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import { EditorEmailAlreadyInUseError } from "@/lib/errors/editor-errors";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";

describe("soft-delete unification", () => {
  describe("studio", () => {
    it("soft-delete sets deleted_at and hides from listing/findById/findByName", async () => {
      const repo = new DrizzleStudioRepository(getTestDb());
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      await repo.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByName("Sonora")).toBeNull();
      expect(await repo.findAll()).toEqual([]);
    });

    it("findByNameIncludingDeleted still returns soft-deleted (case-insensitive)", async () => {
      const repo = new DrizzleStudioRepository(getTestDb());
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
      await repo.softDelete(created.id);

      const found = await repo.findByNameIncludingDeleted("SONORA");

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
    });

    it("reactivate clears deleted_at and preserves original id/createdAt/rate", async () => {
      const repo = new DrizzleStudioRepository(getTestDb());
      const original = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
      await repo.softDelete(original.id);

      const reactivated = await repo.reactivate(original.id);

      expect(reactivated.id).toBe(original.id);
      expect(reactivated.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(reactivated.defaultHourlyRateCents).toBe(8500);
      expect(await repo.findById(original.id)).not.toBeNull();
    });

    it("reactivate with overrides sets new defaultHourlyRateCents (inline flow)", async () => {
      const repo = new DrizzleStudioRepository(getTestDb());
      const original = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
      await repo.softDelete(original.id);

      const reactivated = await repo.reactivate(original.id, { defaultHourlyRateCents: 1 });

      expect(reactivated.id).toBe(original.id);
      expect(reactivated.defaultHourlyRateCents).toBe(1);
    });

    it("allows creating a new studio with the same name once the original is soft-deleted AND nobody reactivates", async () => {
      // This documents how the partial unique index behaves: lower(name) WHERE deleted_at IS NULL.
      const repo = new DrizzleStudioRepository(getTestDb());
      const first = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
      await repo.softDelete(first.id);

      const second = await repo.create({ name: "Sonora", defaultHourlyRateCents: 9000 });

      expect(second.id).not.toBe(first.id);
      // Both rows coexist — the service layer (FR-046a) is what prevents this by
      // calling findByNameIncludingDeleted + reactivate instead of create.
    });
  });

  describe("narrator", () => {
    it("soft-delete hides narrator from findAll/findById/findByName", async () => {
      const repo = new DrizzleNarratorRepository(getTestDb());
      const created = await repo.create({ name: "Ana Silva" });

      await repo.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByName("Ana Silva")).toBeNull();
      expect(await repo.findAll()).toEqual([]);
    });

    it("findByNameIncludingDeleted returns soft-deleted narrator (case-insensitive)", async () => {
      const repo = new DrizzleNarratorRepository(getTestDb());
      const created = await repo.create({ name: "Ana Silva" });
      await repo.softDelete(created.id);

      const found = await repo.findByNameIncludingDeleted("ANA SILVA");

      expect(found?.id).toBe(created.id);
    });

    it("reactivate restores visibility preserving id and createdAt", async () => {
      const repo = new DrizzleNarratorRepository(getTestDb());
      const original = await repo.create({ name: "Ana" });
      await repo.softDelete(original.id);

      const reactivated = await repo.reactivate(original.id);

      expect(reactivated.id).toBe(original.id);
      expect(reactivated.createdAt.getTime()).toBe(original.createdAt.getTime());
      expect(await repo.findById(original.id)).not.toBeNull();
    });
  });

  describe("editor", () => {
    it("soft-delete hides editor from findAll/findById/findByName", async () => {
      const repo = new DrizzleEditorRepository(getTestDb());
      const created = await repo.create({ name: "Carla", email: "carla@example.com" });

      await repo.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByName("Carla")).toBeNull();
      expect(await repo.findAll()).toEqual([]);
    });

    it("findByNameIncludingDeleted returns soft-deleted editor (case-insensitive)", async () => {
      const repo = new DrizzleEditorRepository(getTestDb());
      const created = await repo.create({ name: "Carla", email: "carla@example.com" });
      await repo.softDelete(created.id);

      const found = await repo.findByNameIncludingDeleted("CARLA");

      expect(found?.id).toBe(created.id);
    });

    it("reactivate restores visibility preserving id and email", async () => {
      const repo = new DrizzleEditorRepository(getTestDb());
      const original = await repo.create({ name: "Carla", email: "carla@example.com" });
      await repo.softDelete(original.id);

      const reactivated = await repo.reactivate(original.id);

      expect(reactivated.id).toBe(original.id);
      expect(reactivated.email).toBe("carla@example.com");
    });

    it("editor_email_unique remains GLOBAL — blocks creating a new editor with an email already used by a soft-deleted editor", async () => {
      const repo = new DrizzleEditorRepository(getTestDb());
      const first = await repo.create({ name: "Carla", email: "shared@example.com" });
      await repo.softDelete(first.id);

      await expect(
        repo.create({ name: "Outro Nome", email: "shared@example.com" }),
      ).rejects.toBeInstanceOf(EditorEmailAlreadyInUseError);
    });
  });
});
