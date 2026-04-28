import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  StudioHasActiveBooksError,
  StudioNameAlreadyInUseError,
  StudioNotFoundError,
} from "@/lib/errors/studio-errors";
import { StudioService } from "@/lib/services/studio-service";

describe("StudioService", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  describe("list", () => {
    it("returns empty array when no studios exist", async () => {
      expect(await service.list()).toEqual([]);
    });

    it("returns studios ordered by createdAt ASC", async () => {
      const { studio: first } = await service.create({
        name: "Primeiro",
        defaultHourlyRateCents: 5000,
      });
      const { studio: second } = await service.create({
        name: "Segundo",
        defaultHourlyRateCents: 6000,
      });

      const result = await service.list();

      expect(result.map((s) => s.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates a studio with trimmed name and reactivated=false", async () => {
      const result = await service.create({
        name: "  Sonora Studio  ",
        defaultHourlyRateCents: 8500,
      });

      expect(result.studio.name).toBe("Sonora Studio");
      expect(result.studio.defaultHourlyRateCents).toBe(8500);
      expect(result.studio.id).toEqual(expect.any(String));
      expect(result.reactivated).toBe(false);
      expect(result.rateResetForInline).toBeUndefined();
    });

    it("does not normalize name case (preserves case-sensitive)", async () => {
      const { studio } = await service.create({
        name: "SONORA",
        defaultHourlyRateCents: 8500,
      });
      expect(studio.name).toBe("SONORA");
    });

    it("passes defaultHourlyRateCents through unchanged", async () => {
      const { studio } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8550,
      });
      expect(studio.defaultHourlyRateCents).toBe(8550);
    });

    it("propagates StudioNameAlreadyInUseError on duplicate of an ACTIVE studio", async () => {
      await service.create({ name: "Duplicado", defaultHourlyRateCents: 5000 });

      await expect(
        service.create({ name: "Duplicado", defaultHourlyRateCents: 10000 }),
      ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
    });

    it("reactivates a soft-deleted studio on name collision, preserving original rate", async () => {
      const { studio: original } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });
      await service.softDelete(original.id);

      const result = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 12000,
      });

      expect(result.reactivated).toBe(true);
      expect(result.rateResetForInline).toBeUndefined();
      expect(result.studio.id).toBe(original.id);
      expect(result.studio.name).toBe("Sonora");
      expect(result.studio.defaultHourlyRateCents).toBe(8500);
    });

    it("reactivates case-insensitively (FR-046a)", async () => {
      const { studio: original } = await service.create({
        name: "Sonora Studio",
        defaultHourlyRateCents: 8500,
      });
      await service.softDelete(original.id);

      const result = await service.create({
        name: "SONORA STUDIO",
        defaultHourlyRateCents: 9000,
      });

      expect(result.reactivated).toBe(true);
      expect(result.studio.id).toBe(original.id);
    });

    it("inline=true overrides defaultHourlyRateCents and sets rateResetForInline", async () => {
      const { studio: original } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });
      await service.softDelete(original.id);

      const result = await service.create(
        { name: "Sonora", defaultHourlyRateCents: 1 },
        { inline: true },
      );

      expect(result.reactivated).toBe(true);
      expect(result.rateResetForInline).toBe(true);
      expect(result.studio.id).toBe(original.id);
      expect(result.studio.defaultHourlyRateCents).toBe(1);
    });
  });

  describe("update", () => {
    it("updates name with trim", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      const updated = await service.update(created.id, { name: "  Sonora Plus  " });

      expect(updated.name).toBe("Sonora Plus");
    });

    it("updates only the fields provided", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      const updated = await service.update(created.id, { defaultHourlyRateCents: 10000 });

      expect(updated.name).toBe("Sonora");
      expect(updated.defaultHourlyRateCents).toBe(10000);
    });

    it("is idempotent when values are unchanged", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      const updated = await service.update(created.id, {
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      expect(updated.id).toBe(created.id);
    });

    it("propagates StudioNotFoundError when id does not exist", async () => {
      await expect(service.update("non-existent-id", { name: "X" })).rejects.toBeInstanceOf(
        StudioNotFoundError,
      );
    });

    it("propagates StudioNameAlreadyInUseError on duplicate name via rename", async () => {
      await service.create({ name: "Existente", defaultHourlyRateCents: 8500 });
      const { studio: other } = await service.create({
        name: "Outro",
        defaultHourlyRateCents: 9000,
      });

      await expect(service.update(other.id, { name: "Existente" })).rejects.toBeInstanceOf(
        StudioNameAlreadyInUseError,
      );
    });
  });

  describe("softDelete", () => {
    it("soft-deletes a studio with no active books", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      await service.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByNameIncludingDeleted("Sonora")).not.toBeNull();
    });

    it("throws StudioHasActiveBooksError when active books are present", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      await expect(
        service.softDelete(created.id, {
          getActiveBooks: async () => [
            { id: "book-1", title: "Livro Bloqueio" },
            { id: "book-2", title: "Outro Livro" },
            { id: "book-3", title: "Mais um" },
          ],
        }),
      ).rejects.toBeInstanceOf(StudioHasActiveBooksError);

      // not soft-deleted
      expect(await repo.findById(created.id)).not.toBeNull();
    });

    it("propagates StudioNotFoundError when id does not exist", async () => {
      await expect(service.softDelete("non-existent-id")).rejects.toBeInstanceOf(
        StudioNotFoundError,
      );
    });
  });

  describe("delete (hard delete — legacy)", () => {
    it("removes a studio by id", async () => {
      const { studio: created } = await service.create({
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      await service.delete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
    });

    it("propagates StudioNotFoundError when id does not exist", async () => {
      await expect(service.delete("non-existent-id")).rejects.toBeInstanceOf(StudioNotFoundError);
    });
  });
});
