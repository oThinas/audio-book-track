import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  EditorEmailAlreadyInUseError,
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
      const first = await service.create({ name: "Primeiro", email: "1@s.com" });
      const second = await service.create({ name: "Segundo", email: "2@s.com" });

      const result = await service.list();

      expect(result.map((e) => e.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates an editor with trimmed name and normalized email", async () => {
      const created = await service.create({
        name: "  Carla  ",
        email: "  Carla@Studio.com  ",
      });

      expect(created.name).toBe("Carla");
      expect(created.email).toBe("carla@studio.com");
      expect(created.id).toEqual(expect.any(String));
    });

    it("propagates EditorNameAlreadyInUseError on duplicate name", async () => {
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
  });

  describe("update", () => {
    it("updates the name (trimmed)", async () => {
      const created = await service.create({ name: "Original", email: "orig@s.com" });

      const updated = await service.update(created.id, { name: "  Novo  " });

      expect(updated.name).toBe("Novo");
      expect(updated.email).toBe("orig@s.com");
    });

    it("updates the email (trimmed + lowercased)", async () => {
      const created = await service.create({ name: "Carla", email: "orig@s.com" });

      const updated = await service.update(created.id, { email: "  Novo@S.COM  " });

      expect(updated.name).toBe("Carla");
      expect(updated.email).toBe("novo@s.com");
    });

    it("accepts an empty update (no-op)", async () => {
      const created = await service.create({ name: "Carla", email: "c@s.com" });

      const updated = await service.update(created.id, {});

      expect(updated.name).toBe("Carla");
      expect(updated.email).toBe("c@s.com");
    });

    it("is idempotent when renaming to the same name", async () => {
      const created = await service.create({ name: "Mesmo", email: "m@s.com" });

      const updated = await service.update(created.id, { name: "Mesmo" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Mesmo");
    });

    it("is idempotent when the email differs only in casing", async () => {
      const created = await service.create({ name: "Carla", email: "carla@s.com" });

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
      const second = await service.create({ name: "Segundo", email: "2@s.com" });

      await expect(service.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        EditorNameAlreadyInUseError,
      );
    });

    it("propagates EditorEmailAlreadyInUseError on email clash (case-insensitive)", async () => {
      await service.create({ name: "Primeiro", email: "same@s.com" });
      const second = await service.create({ name: "Segundo", email: "other@s.com" });

      await expect(service.update(second.id, { email: "SAME@S.COM" })).rejects.toBeInstanceOf(
        EditorEmailAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes the editor", async () => {
      const created = await service.create({ name: "Carla", email: "c@s.com" });

      await service.delete(created.id);

      expect(await service.list()).toEqual([]);
    });

    it("propagates EditorNotFoundError when id does not exist", async () => {
      await expect(service.delete(crypto.randomUUID())).rejects.toBeInstanceOf(EditorNotFoundError);
    });
  });
});
