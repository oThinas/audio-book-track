import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
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
      const first = await service.create({ name: "Primeiro", defaultHourlyRateCents: 5000 });
      const second = await service.create({ name: "Segundo", defaultHourlyRateCents: 6000 });

      const result = await service.list();

      expect(result.map((s) => s.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates a studio with trimmed name", async () => {
      const created = await service.create({
        name: "  Sonora Studio  ",
        defaultHourlyRateCents: 8500,
      });

      expect(created.name).toBe("Sonora Studio");
      expect(created.defaultHourlyRateCents).toBe(8500);
      expect(created.id).toEqual(expect.any(String));
    });

    it("does not normalize name case (preserves case-sensitive)", async () => {
      const created = await service.create({ name: "SONORA", defaultHourlyRateCents: 8500 });
      expect(created.name).toBe("SONORA");
    });

    it("passes defaultHourlyRateCents through unchanged", async () => {
      const created = await service.create({ name: "Sonora", defaultHourlyRateCents: 8550 });
      expect(created.defaultHourlyRateCents).toBe(8550);
    });

    it("propagates StudioNameAlreadyInUseError on duplicate name", async () => {
      await service.create({ name: "Duplicado", defaultHourlyRateCents: 5000 });

      await expect(
        service.create({ name: "Duplicado", defaultHourlyRateCents: 10000 }),
      ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
    });
  });

  describe("update", () => {
    it("updates name with trim", async () => {
      const created = await service.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await service.update(created.id, { name: "  Sonora Plus  " });

      expect(updated.name).toBe("Sonora Plus");
    });

    it("updates only the fields provided", async () => {
      const created = await service.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await service.update(created.id, { defaultHourlyRateCents: 10000 });

      expect(updated.name).toBe("Sonora");
      expect(updated.defaultHourlyRateCents).toBe(10000);
    });

    it("is idempotent when values are unchanged", async () => {
      const created = await service.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

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
      const other = await service.create({ name: "Outro", defaultHourlyRateCents: 9000 });

      await expect(service.update(other.id, { name: "Existente" })).rejects.toBeInstanceOf(
        StudioNameAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes a studio by id", async () => {
      const created = await service.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      await service.delete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
    });

    it("propagates StudioNotFoundError when id does not exist", async () => {
      await expect(service.delete("non-existent-id")).rejects.toBeInstanceOf(StudioNotFoundError);
    });
  });
});
