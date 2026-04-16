import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import {
  NarratorEmailAlreadyInUseError,
  NarratorNotFoundError,
} from "@/lib/errors/narrator-errors";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";

function createRepo() {
  return new DrizzleNarratorRepository(getTestDb());
}

describe("DrizzleNarratorRepository", () => {
  describe("create", () => {
    it("persists a narrator and returns the full record", async () => {
      const repo = createRepo();

      const created = await repo.create({
        name: "João Silva",
        email: "joao@exemplo.com",
      });

      expect(created.id).toEqual(expect.any(String));
      expect(created.name).toBe("João Silva");
      expect(created.email).toBe("joao@exemplo.com");
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("throws NarratorEmailAlreadyInUseError on duplicate email", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro", email: "dup@exemplo.com" });

      await expect(
        repo.create({ name: "Segundo", email: "dup@exemplo.com" }),
      ).rejects.toBeInstanceOf(NarratorEmailAlreadyInUseError);
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
      const first = await repo.create({ name: "Primeiro", email: "a@exemplo.com" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await repo.create({ name: "Segundo", email: "b@exemplo.com" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const third = await repo.create({ name: "Terceiro", email: "c@exemplo.com" });

      const result = await repo.findAll();

      expect(result.map((narrator) => narrator.id)).toEqual([first.id, second.id, third.id]);
    });
  });

  describe("findById", () => {
    it("returns the narrator when id exists", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João", email: "joao@exemplo.com" });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe("joao@exemplo.com");
    });

    it("returns null when id does not exist", async () => {
      const repo = createRepo();
      const found = await repo.findById(crypto.randomUUID());
      expect(found).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("returns the narrator when email exists", async () => {
      const repo = createRepo();
      await repo.create({ name: "Maria", email: "maria@exemplo.com" });

      const found = await repo.findByEmail("maria@exemplo.com");

      expect(found).not.toBeNull();
      expect(found?.email).toBe("maria@exemplo.com");
    });

    it("returns null when email does not exist", async () => {
      const repo = createRepo();
      const found = await repo.findByEmail("missing@exemplo.com");
      expect(found).toBeNull();
    });
  });

  describe("update", () => {
    it("updates name only and refreshes updatedAt", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Original", email: "orig@exemplo.com" });

      const updated = await repo.update(created.id, { name: "Atualizado" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Atualizado");
      expect(updated.email).toBe("orig@exemplo.com");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(created.updatedAt.getTime());
    });

    it("updates email only", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João", email: "joao@exemplo.com" });

      const updated = await repo.update(created.id, { email: "novo@exemplo.com" });

      expect(updated.email).toBe("novo@exemplo.com");
      expect(updated.name).toBe("João");
    });

    it("updates both fields at once", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João", email: "joao@exemplo.com" });

      const updated = await repo.update(created.id, {
        name: "João Santos",
        email: "santos@exemplo.com",
      });

      expect(updated.name).toBe("João Santos");
      expect(updated.email).toBe("santos@exemplo.com");
    });

    it("throws NarratorNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.update(crypto.randomUUID(), { name: "Novo" })).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });

    it("throws NarratorEmailAlreadyInUseError when email belongs to another narrator", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro", email: "first@exemplo.com" });
      const second = await repo.create({ name: "Segundo", email: "second@exemplo.com" });

      await expect(repo.update(second.id, { email: "first@exemplo.com" })).rejects.toBeInstanceOf(
        NarratorEmailAlreadyInUseError,
      );
    });

    it("allows updating a narrator with its own email unchanged", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João", email: "joao@exemplo.com" });

      const updated = await repo.update(created.id, {
        name: "João Silva",
        email: "joao@exemplo.com",
      });

      expect(updated.name).toBe("João Silva");
      expect(updated.email).toBe("joao@exemplo.com");
    });
  });

  describe("delete", () => {
    it("removes the narrator", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "João", email: "joao@exemplo.com" });

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
