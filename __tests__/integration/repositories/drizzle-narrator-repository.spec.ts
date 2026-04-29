import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";

function createRepo() {
  return new DrizzleNarratorRepository(getTestDb());
}

describe("DrizzleNarratorRepository", () => {
  describe("create", () => {
    it("persists a narrator and returns the full record (without email)", async () => {
      const repo = createRepo();

      const created = await repo.create({ name: "João Silva" });

      expect(created.id).toEqual(expect.any(String));
      expect(created.name).toBe("João Silva");
      expect(created).not.toHaveProperty("email");
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("throws NarratorNameAlreadyInUseError on duplicate name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Duplicado" });

      await expect(repo.create({ name: "Duplicado" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });

    it("rejects two narrators whose names differ only in case (case-insensitive partial unique on lower(name))", async () => {
      const repo = createRepo();
      await repo.create({ name: "joão" });

      await expect(repo.create({ name: "JOÃO" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });
  });

  describe("findAll", () => {
    it("returns empty array when no narrators exist", async () => {
      const repo = createRepo();
      const result = await repo.findAll();
      expect(result).toEqual([]);
    });

    it("returns narrators ordered by createdAt ASC", async () => {
      const repo = createRepo();
      const first = await repo.create({ name: "Primeiro" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await repo.create({ name: "Segundo" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const third = await repo.create({ name: "Terceiro" });

      const result = await repo.findAll();

      expect(result.map((narrator) => narrator.id)).toEqual([first.id, second.id, third.id]);
    });
  });

  describe("findById", () => {
    it("returns the narrator when id exists", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João" });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.name).toBe("João");
    });

    it("returns null when id does not exist", async () => {
      const repo = createRepo();
      const found = await repo.findById(crypto.randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the narrator when an exact-case name exists", async () => {
      const repo = createRepo();
      await repo.create({ name: "Maria" });

      const found = await repo.findByName("Maria");

      expect(found).not.toBeNull();
      expect(found?.name).toBe("Maria");
    });

    it("matches case-insensitively (consistent with the lower(name) partial unique index)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Maria" });

      expect(await repo.findByName("maria")).toEqual(created);
      expect(await repo.findByName("MARIA")).toEqual(created);
    });

    it("returns null when name does not exist", async () => {
      const repo = createRepo();
      const found = await repo.findByName("Inexistente");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("updates name and refreshes updatedAt", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Original" });

      const updated = await repo.update(created.id, { name: "Atualizado" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Atualizado");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it("throws NarratorNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.update(crypto.randomUUID(), { name: "Novo" })).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });

    it("throws NarratorNameAlreadyInUseError when name belongs to another narrator", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro" });
      const second = await repo.create({ name: "Segundo" });

      await expect(repo.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });

    it("allows updating a narrator with its own name unchanged (idempotent)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João" });

      const updated = await repo.update(created.id, { name: "João" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("João");
    });
  });

  describe("delete", () => {
    it("removes the narrator", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João" });

      await repo.delete(created.id);

      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });

    it("throws NarratorNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.delete(crypto.randomUUID())).rejects.toBeInstanceOf(NarratorNotFoundError);
    });
  });
});
