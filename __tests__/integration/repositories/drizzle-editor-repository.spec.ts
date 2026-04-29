import { getTestDb } from "@tests/helpers/db";
import { describe, expect, it } from "vitest";

import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import { DrizzleEditorRepository } from "@/lib/repositories/drizzle/drizzle-editor-repository";

function createRepo() {
  return new DrizzleEditorRepository(getTestDb());
}

describe("DrizzleEditorRepository", () => {
  describe("create", () => {
    it("persists an editor and returns the full record with timestamps", async () => {
      const repo = createRepo();

      const created = await repo.create({ name: "Carla Mendes", email: "carla@studio.com" });

      expect(created.id).toEqual(expect.any(String));
      expect(created.name).toBe("Carla Mendes");
      expect(created.email).toBe("carla@studio.com");
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("throws EditorNameAlreadyInUseError on duplicate name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Duplicado", email: "a@studio.com" });

      await expect(
        repo.create({ name: "Duplicado", email: "b@studio.com" }),
      ).rejects.toBeInstanceOf(EditorNameAlreadyInUseError);
    });

    it("throws EditorEmailAlreadyInUseError on duplicate email", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro", email: "mesmo@studio.com" });

      await expect(
        repo.create({ name: "Segundo", email: "mesmo@studio.com" }),
      ).rejects.toBeInstanceOf(EditorEmailAlreadyInUseError);
    });

    it("rejects two editors whose names differ only in case (case-insensitive partial unique on lower(name))", async () => {
      const repo = createRepo();
      await repo.create({ name: "carla", email: "lower@studio.com" });

      await expect(
        repo.create({ name: "CARLA", email: "upper@studio.com" }),
      ).rejects.toBeInstanceOf(EditorNameAlreadyInUseError);
    });
  });

  describe("findAll", () => {
    it("returns empty array when no editors exist", async () => {
      const repo = createRepo();
      expect(await repo.findAll()).toEqual([]);
    });

    it("returns editors ordered by createdAt ASC", async () => {
      const repo = createRepo();
      const first = await repo.create({ name: "Primeiro", email: "1@s.com" });
      await new Promise((r) => setTimeout(r, 5));
      const second = await repo.create({ name: "Segundo", email: "2@s.com" });
      await new Promise((r) => setTimeout(r, 5));
      const third = await repo.create({ name: "Terceiro", email: "3@s.com" });

      const result = await repo.findAll();

      expect(result.map((e) => e.id)).toEqual([first.id, second.id, third.id]);
    });
  });

  describe("findById", () => {
    it("returns the editor when id exists", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Carla", email: "c@s.com" });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe("c@s.com");
    });

    it("returns null when id does not exist", async () => {
      const repo = createRepo();
      expect(await repo.findById(crypto.randomUUID())).toBeNull();
    });
  });

  describe("findByName", () => {
    it("returns the editor when an exact-case name exists", async () => {
      const repo = createRepo();
      await repo.create({ name: "Maria", email: "m@s.com" });

      const found = await repo.findByName("Maria");

      expect(found).not.toBeNull();
      expect(found?.name).toBe("Maria");
    });

    it("matches case-insensitively (consistent with the lower(name) partial unique index)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Maria", email: "m@s.com" });

      expect(await repo.findByName("maria")).toEqual(created);
      expect(await repo.findByName("MARIA")).toEqual(created);
    });

    it("returns null when name does not exist", async () => {
      const repo = createRepo();
      expect(await repo.findByName("Inexistente")).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("returns the editor when email exists (service stores already normalized)", async () => {
      const repo = createRepo();
      await repo.create({ name: "Carla", email: "carla@studio.com" });

      const found = await repo.findByEmail("carla@studio.com");

      expect(found).not.toBeNull();
      expect(found?.email).toBe("carla@studio.com");
    });

    it("returns null when email does not exist", async () => {
      const repo = createRepo();
      expect(await repo.findByEmail("missing@studio.com")).toBeNull();
    });
  });

  describe("update", () => {
    it("updates name and email", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Original", email: "orig@s.com" });

      const updated = await repo.update(created.id, { name: "Novo", email: "novo@s.com" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Novo");
      expect(updated.email).toBe("novo@s.com");
    });

    it("supports partial update (only name)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Original", email: "orig@s.com" });

      const updated = await repo.update(created.id, { name: "Novo" });

      expect(updated.name).toBe("Novo");
      expect(updated.email).toBe("orig@s.com");
    });

    it("supports partial update (only email)", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Original", email: "orig@s.com" });

      const updated = await repo.update(created.id, { email: "novo@s.com" });

      expect(updated.name).toBe("Original");
      expect(updated.email).toBe("novo@s.com");
    });

    it("is idempotent when values do not change", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Carla", email: "c@s.com" });

      const updated = await repo.update(created.id, { name: "Carla", email: "c@s.com" });

      expect(updated.name).toBe("Carla");
      expect(updated.email).toBe("c@s.com");
    });

    it("throws EditorNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.update(crypto.randomUUID(), { name: "Novo" })).rejects.toBeInstanceOf(
        EditorNotFoundError,
      );
    });

    it("throws EditorNameAlreadyInUseError when renaming to another editor's name", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro", email: "1@s.com" });
      const second = await repo.create({ name: "Segundo", email: "2@s.com" });

      await expect(repo.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        EditorNameAlreadyInUseError,
      );
    });

    it("throws EditorEmailAlreadyInUseError when re-emailing to another editor's email", async () => {
      const repo = createRepo();
      await repo.create({ name: "Primeiro", email: "same@s.com" });
      const second = await repo.create({ name: "Segundo", email: "other@s.com" });

      await expect(repo.update(second.id, { email: "same@s.com" })).rejects.toBeInstanceOf(
        EditorEmailAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes the editor", async () => {
      const repo = createRepo();
      const created = await repo.create({ name: "Carla", email: "c@s.com" });

      await repo.delete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
    });

    it("throws EditorNotFoundError when id does not exist", async () => {
      const repo = createRepo();
      await expect(repo.delete(crypto.randomUUID())).rejects.toBeInstanceOf(EditorNotFoundError);
    });
  });
});
