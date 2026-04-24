import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";

function createRepo() {
  return new DrizzleStudioRepository(getTestDb());
}

describe("DrizzleStudioRepository", () => {
  describe("create", () => {
    it("persists a studio and returns the full record with timestamps", async () => {
      const repo = createRepo();

      const created = await repo.create({ name: "Sonora Studio", defaultHourlyRateCents: 8500 });

      expect(created.id).toEqual(expect.any(String));
      expect(created.name).toBe("Sonora Studio");
      expect(created.defaultHourlyRateCents).toBe(8500);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("returns defaultHourlyRateCents as a number (integer, not string)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8550 });

      expect(typeof created.defaultHourlyRateCents).toBe("number");
      expect(Number.isInteger(created.defaultHourlyRateCents)).toBe(true);
      expect(created.defaultHourlyRateCents).toBe(8550);
    });

    it("persists integer cents exactly (no floating-point drift)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8555 });

      expect(created.defaultHourlyRateCents).toBe(8555);
    });

    it("throws StudioNameAlreadyInUseError on duplicate name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Duplicado", defaultHourlyRateCents: 5000 });

      await expect(
        repo.create({ name: "Duplicado", defaultHourlyRateCents: 10000 }),
      ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
    });

    it("rejects two studios whose names differ only in case (case-insensitive partial unique on lower(name))", async () => {
      const repo = createRepo();
      await repo.create({ name: "sonora", defaultHourlyRateCents: 5000 });

      await expect(
        repo.create({ name: "SONORA", defaultHourlyRateCents: 5000 }),
      ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
    });

    it("allows multiple studios with the same defaultHourlyRateCents (no unique on value)", async () => {
      const repo = createRepo();
      const first = await repo.create({ name: "Alfa", defaultHourlyRateCents: 8500 });
      const second = await repo.create({ name: "Beta", defaultHourlyRateCents: 8500 });

      expect(first.id).not.toBe(second.id);
      expect(first.defaultHourlyRateCents).toBe(8500);
      expect(second.defaultHourlyRateCents).toBe(8500);
    });
  });

  describe("findAll", () => {
    it("returns empty array when no studios exist", async () => {
      const repo = createRepo();
      expect(await repo.findAll()).toEqual([]);
    });

    it("returns all studios with createdAt non-decreasing", async () => {
      // Note: Postgres `now()` é transaction-aligned, então dentro do
      // BEGIN/ROLLBACK do setup de integração todos os inserts recebem o
      // mesmo createdAt. A propriedade testável é: todos os registros
      // aparecem e createdAt nunca decresce. Em produção (fora de transação
      // envolvente) os timestamps diferem naturalmente por request.
      const repo = createRepo();
      const first = await repo.create({ name: "Primeiro", defaultHourlyRateCents: 5000 });
      const second = await repo.create({ name: "Segundo", defaultHourlyRateCents: 6000 });
      const third = await repo.create({ name: "Terceiro", defaultHourlyRateCents: 7000 });

      const result = await repo.findAll();

      expect(result.map((s) => s.id).sort()).toEqual([first.id, second.id, third.id].sort());
      for (let i = 1; i < result.length; i++) {
        expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          result[i - 1].createdAt.getTime(),
        );
      }
    });

    it("returns all records with defaultHourlyRateCents typed as integer number", async () => {
      const repo = createRepo();
      await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
      await repo.create({ name: "Voz & Arte", defaultHourlyRateCents: 9050 });

      const result = await repo.findAll();

      expect(
        result.every(
          (s) =>
            typeof s.defaultHourlyRateCents === "number" &&
            Number.isInteger(s.defaultHourlyRateCents),
        ),
      ).toBe(true);
    });
  });

  describe("findById", () => {
    it("returns the studio when id exists", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const found = await repo.findById(created.id);

      expect(found).toEqual(created);
    });

    it("returns null when id does not exist", async () => {
      const repo = createRepo();
      expect(await repo.findById("non-existent-id")).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the studio when name matches exactly", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      expect(await repo.findByName("Sonora")).toEqual(created);
    });

    it("returns null when name does not match (case-sensitive eq)", async () => {
      const repo = createRepo();
      await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      expect(await repo.findByName("sonora")).toBeNull();
      expect(await repo.findByName("SONORA")).toBeNull();
    });
  });

  describe("update", () => {
    it("updates name only, preserving defaultHourlyRateCents", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await repo.update(created.id, { name: "Sonora Plus" });

      expect(updated.name).toBe("Sonora Plus");
      expect(updated.defaultHourlyRateCents).toBe(8500);
    });

    it("updates defaultHourlyRateCents only, preserving name", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await repo.update(created.id, { defaultHourlyRateCents: 10000 });

      expect(updated.name).toBe("Sonora");
      expect(updated.defaultHourlyRateCents).toBe(10000);
    });

    it("updates both fields", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await repo.update(created.id, {
        name: "Sonora Plus",
        defaultHourlyRateCents: 12000,
      });

      expect(updated.name).toBe("Sonora Plus");
      expect(updated.defaultHourlyRateCents).toBe(12000);
    });

    it("is idempotent with same values (does not raise unique-violation against itself)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      const updated = await repo.update(created.id, {
        name: "Sonora",
        defaultHourlyRateCents: 8500,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Sonora");
    });

    it("throws StudioNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.update("non-existent-id", { name: "X" })).rejects.toBeInstanceOf(
        StudioNotFoundError,
      );
    });

    it("throws StudioNameAlreadyInUseError when renaming to an existing name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Existente", defaultHourlyRateCents: 8500 });
      const other = await repo.create({ name: "Outro", defaultHourlyRateCents: 9000 });

      await expect(repo.update(other.id, { name: "Existente" })).rejects.toBeInstanceOf(
        StudioNameAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes a studio by id", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });

      await repo.delete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
    });

    it("throws StudioNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.delete("non-existent-id")).rejects.toBeInstanceOf(StudioNotFoundError);
    });
  });
});
