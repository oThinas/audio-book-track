import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  EditorEmailAlreadyInUseError,
  EditorLinkedToActiveChaptersError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import { EditorService } from "@/lib/services/editor-service";

describe("EditorService", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  describe("list", () => {
    it("returns empty array when no editors exist", async () => {
      expect(await service.list()).toEqual([]);
    });

    it("returns editors ordered by createdAt ASC", async () => {
      const { editor: first } = await service.create({ name: "Primeiro", email: "1@s.com" });
      const { editor: second } = await service.create({ name: "Segundo", email: "2@s.com" });

      const result = await service.list();

      expect(result.map((e) => e.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates an editor with trimmed name and normalized email and reactivated=false", async () => {
      const result = await service.create({
        name: "  Carla  ",
        email: "  Carla@Studio.com  ",
      });

      expect(result.editor.name).toBe("Carla");
      expect(result.editor.email).toBe("carla@studio.com");
      expect(result.editor.id).toEqual(expect.any(String));
      expect(result.reactivated).toBe(false);
    });

    it("propagates EditorNameAlreadyInUseError on duplicate of ACTIVE editor", async () => {
      await service.create({ name: "Duplicado", email: "a@s.com" });

      await expect(service.create({ name: "Duplicado", email: "b@s.com" })).rejects.toBeInstanceOf(
        EditorNameAlreadyInUseError,
      );
    });

    it("propagates EditorEmailAlreadyInUseError on duplicate email (case-insensitive)", async () => {
      await service.create({ name: "Primeiro", email: "same@s.com" });

      await expect(service.create({ name: "Segundo", email: "SAME@S.COM" })).rejects.toBeInstanceOf(
        EditorEmailAlreadyInUseError,
      );
    });

    it("reactivates a soft-deleted editor on name collision, preserving original email", async () => {
      const { editor: original } = await service.create({
        name: "Carla",
        email: "carla@s.com",
      });
      await service.softDelete(original.id);

      const result = await service.create({ name: "Carla", email: "new@s.com" });

      expect(result.reactivated).toBe(true);
      expect(result.editor.id).toBe(original.id);
      expect(result.editor.email).toBe("carla@s.com");
    });
  });

  describe("update", () => {
    it("updates the name (trimmed)", async () => {
      const { editor: created } = await service.create({
        name: "Original",
        email: "orig@s.com",
      });

      const updated = await service.update(created.id, { name: "  Novo  " });

      expect(updated.name).toBe("Novo");
      expect(updated.email).toBe("orig@s.com");
    });

    it("updates the email (trimmed + lowercased)", async () => {
      const { editor: created } = await service.create({ name: "Carla", email: "orig@s.com" });

      const updated = await service.update(created.id, { email: "  Novo@S.COM  " });

      expect(updated.name).toBe("Carla");
      expect(updated.email).toBe("novo@s.com");
    });

    it("accepts an empty update (no-op)", async () => {
      const { editor: created } = await service.create({ name: "Carla", email: "c@s.com" });

      const updated = await service.update(created.id, {});

      expect(updated.name).toBe("Carla");
      expect(updated.email).toBe("c@s.com");
    });

    it("is idempotent when renaming to the same name", async () => {
      const { editor: created } = await service.create({ name: "Mesmo", email: "m@s.com" });

      const updated = await service.update(created.id, { name: "Mesmo" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Mesmo");
    });

    it("is idempotent when the email differs only in casing", async () => {
      const { editor: created } = await service.create({
        name: "Carla",
        email: "carla@s.com",
      });

      const updated = await service.update(created.id, { email: "Carla@S.COM" });

      expect(updated.id).toBe(created.id);
      expect(updated.email).toBe("carla@s.com");
    });

    it("propagates EditorNotFoundError when id does not exist", async () => {
      await expect(service.update(crypto.randomUUID(), { name: "X" })).rejects.toBeInstanceOf(
        EditorNotFoundError,
      );
    });

    it("propagates EditorNameAlreadyInUseError on name clash", async () => {
      await service.create({ name: "Primeiro", email: "1@s.com" });
      const { editor: second } = await service.create({ name: "Segundo", email: "2@s.com" });

      await expect(service.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        EditorNameAlreadyInUseError,
      );
    });

    it("propagates EditorEmailAlreadyInUseError on email clash (case-insensitive)", async () => {
      await service.create({ name: "Primeiro", email: "same@s.com" });
      const { editor: second } = await service.create({ name: "Segundo", email: "other@s.com" });

      await expect(service.update(second.id, { email: "SAME@S.COM" })).rejects.toBeInstanceOf(
        EditorEmailAlreadyInUseError,
      );
    });
  });

  describe("softDelete", () => {
    it("soft-deletes an editor with no active chapters", async () => {
      const { editor: created } = await service.create({ name: "Carla", email: "c@s.com" });

      await service.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByNameIncludingDeleted("Carla")).not.toBeNull();
    });

    it("throws EditorLinkedToActiveChaptersError when active chapters are present", async () => {
      const { editor: created } = await service.create({ name: "Carla", email: "c@s.com" });

      await expect(
        service.softDelete(created.id, {
          getActiveBooks: async () => [
            { id: "book-1", title: "Livro 1" },
            { id: "book-2", title: "Livro 2" },
            { id: "book-3", title: "Livro 3" },
            { id: "book-4", title: "Livro 4" },
          ],
        }),
      ).rejects.toBeInstanceOf(EditorLinkedToActiveChaptersError);

      expect(await repo.findById(created.id)).not.toBeNull();
    });

    it("propagates EditorNotFoundError when id does not exist", async () => {
      await expect(service.softDelete(crypto.randomUUID())).rejects.toBeInstanceOf(
        EditorNotFoundError,
      );
    });
  });

  describe("delete (hard delete — legacy)", () => {
    it("removes the editor", async () => {
      const { editor: created } = await service.create({ name: "Carla", email: "c@s.com" });

      await service.delete(created.id);

      expect(await service.list()).toEqual([]);
    });

    it("propagates EditorNotFoundError when id does not exist", async () => {
      await expect(service.delete(crypto.randomUUID())).rejects.toBeInstanceOf(EditorNotFoundError);
    });
  });
});
