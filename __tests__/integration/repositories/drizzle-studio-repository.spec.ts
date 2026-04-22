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

      const created = await repo.create({ name: "Sonora Studio", defaultHourlyRate: 85 });

      expect(created.id).toEqual(expect.any(String));
      expect(created.name).toBe("Sonora Studio");
      expect(created.defaultHourlyRate).toBe(85);
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("returns defaultHourlyRate as a number, not string (round-trip numeric↔number)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85.5 });

      expect(typeof created.defaultHourlyRate).toBe("number");
      expect(created.defaultHourlyRate).toBe(85.5);
    });

    it("persists values with two decimal places exactly", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85.55 });

      expect(created.defaultHourlyRate).toBe(85.55);
    });

    it("throws StudioNameAlreadyInUseError on duplicate name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Duplicado", defaultHourlyRate: 50 });

      await expect(
        repo.create({ name: "Duplicado", defaultHourlyRate: 100 }),
      ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
    });

    it("accepts two studios whose names differ only in case (case-sensitive unique on name)", async () => {
      const repo = createRepo();
      const lower = await repo.create({ name: "sonora", defaultHourlyRate: 50 });
      const upper = await repo.create({ name: "SONORA", defaultHourlyRate: 50 });

      expect(lower.id).not.toBe(upper.id);
    });

    it("allows multiple studios with the same defaultHourlyRate (no unique on value)", async () => {
      const repo = createRepo();
      const first = await repo.create({ name: "Alfa", defaultHourlyRate: 85 });
      const second = await repo.create({ name: "Beta", defaultHourlyRate: 85 });

      expect(first.id).not.toBe(second.id);
      expect(first.defaultHourlyRate).toBe(85);
      expect(second.defaultHourlyRate).toBe(85);
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
      const first = await repo.create({ name: "Primeiro", defaultHourlyRate: 50 });
      const second = await repo.create({ name: "Segundo", defaultHourlyRate: 60 });
      const third = await repo.create({ name: "Terceiro", defaultHourlyRate: 70 });

      const result = await repo.findAll();

      expect(result.map((s) => s.id).sort()).toEqual([first.id, second.id, third.id].sort());
      for (let i = 1; i < result.length; i++) {
        expect(result[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          result[i - 1].createdAt.getTime(),
        );
      }
    });

    it("returns all records with defaultHourlyRate typed as number", async () => {
      const repo = createRepo();
      await repo.create({ name: "Sonora", defaultHourlyRate: 85 });
      await repo.create({ name: "Voz & Arte", defaultHourlyRate: 90.5 });

      const result = await repo.findAll();

      expect(result.every((s) => typeof s.defaultHourlyRate === "number")).toBe(true);
    });
  });

  describe("findById", () => {
    it("returns the studio when id exists", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

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
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      expect(await repo.findByName("Sonora")).toEqual(created);
    });

    it("returns null when name does not match (case-sensitive)", async () => {
      const repo = createRepo();
      await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      expect(await repo.findByName("sonora")).toBeNull();
      expect(await repo.findByName("SONORA")).toBeNull();
    });
  });

  describe("update", () => {
    it("updates name only, preserving defaultHourlyRate", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      const updated = await repo.update(created.id, { name: "Sonora Plus" });

      expect(updated.name).toBe("Sonora Plus");
      expect(updated.defaultHourlyRate).toBe(85);
    });

    it("updates defaultHourlyRate only, preserving name", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      const updated = await repo.update(created.id, { defaultHourlyRate: 100 });

      expect(updated.name).toBe("Sonora");
      expect(updated.defaultHourlyRate).toBe(100);
    });

    it("updates both fields", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      const updated = await repo.update(created.id, {
        name: "Sonora Plus",
        defaultHourlyRate: 120,
      });

      expect(updated.name).toBe("Sonora Plus");
      expect(updated.defaultHourlyRate).toBe(120);
    });

    it("is idempotent with same values (does not raise unique-violation against itself)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      const updated = await repo.update(created.id, {
        name: "Sonora",
        defaultHourlyRate: 85,
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
      await repo.create({ name: "Existente", defaultHourlyRate: 85 });
      const other = await repo.create({ name: "Outro", defaultHourlyRate: 90 });

      await expect(repo.update(other.id, { name: "Existente" })).rejects.toBeInstanceOf(
        StudioNameAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes a studio by id", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Sonora", defaultHourlyRate: 85 });

      await repo.delete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
    });

    it("throws StudioNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.delete("non-existent-id")).rejects.toBeInstanceOf(StudioNotFoundError);
    });
  });
});
