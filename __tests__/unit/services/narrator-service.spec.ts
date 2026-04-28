import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NarratorLinkedToActiveChaptersError,
  NarratorNameAlreadyInUseError,
  NarratorNotFoundError,
} from "@/lib/errors/narrator-errors";
import { NarratorService } from "@/lib/services/narrator-service";

describe("NarratorService", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  describe("list", () => {
    it("returns empty array when no narrators exist", async () => {
      const result = await service.list();
      expect(result).toEqual([]);
    });

    it("returns narrators ordered by createdAt ASC", async () => {
      const { narrator: first } = await service.create({ name: "Primeiro" });
      const { narrator: second } = await service.create({ name: "Segundo" });

      const result = await service.list();

      expect(result.map((n) => n.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates a narrator with the provided name and reactivated=false", async () => {
      const result = await service.create({ name: "João" });

      expect(result.narrator.name).toBe("João");
      expect(result.narrator.id).toEqual(expect.any(String));
      expect(result.narrator).not.toHaveProperty("email");
      expect(result.reactivated).toBe(false);
    });

    it("propagates NarratorNameAlreadyInUseError on duplicate of ACTIVE narrator", async () => {
      await service.create({ name: "Duplicado" });

      await expect(service.create({ name: "Duplicado" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });

    it("reactivates a soft-deleted narrator on name collision (FR-047a)", async () => {
      const { narrator: original } = await service.create({ name: "Ana Silva" });
      await service.softDelete(original.id);

      const result = await service.create({ name: "Ana Silva" });

      expect(result.reactivated).toBe(true);
      expect(result.narrator.id).toBe(original.id);
      expect(result.narrator.name).toBe("Ana Silva");
    });

    it("reactivates case-insensitively", async () => {
      const { narrator: original } = await service.create({ name: "Ana Silva" });
      await service.softDelete(original.id);

      const result = await service.create({ name: "ANA SILVA" });

      expect(result.reactivated).toBe(true);
      expect(result.narrator.id).toBe(original.id);
    });
  });

  describe("update", () => {
    it("updates the name", async () => {
      const { narrator: created } = await service.create({ name: "Original" });

      const updated = await service.update(created.id, { name: "Atualizado" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Atualizado");
    });

    it("is idempotent when renaming to the same name", async () => {
      const { narrator: created } = await service.create({ name: "Mesmo Nome" });

      const updated = await service.update(created.id, { name: "Mesmo Nome" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Mesmo Nome");
    });

    it("propagates NarratorNotFoundError when id does not exist", async () => {
      await expect(service.update(crypto.randomUUID(), { name: "X" })).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });

    it("propagates NarratorNameAlreadyInUseError when renaming to another narrator's name", async () => {
      await service.create({ name: "Primeiro" });
      const { narrator: second } = await service.create({ name: "Segundo" });

      await expect(service.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });
  });

  describe("softDelete", () => {
    it("soft-deletes a narrator with no active chapters", async () => {
      const { narrator: created } = await service.create({ name: "Ana" });

      await service.softDelete(created.id);

      expect(await repo.findById(created.id)).toBeNull();
      expect(await repo.findByNameIncludingDeleted("Ana")).not.toBeNull();
    });

    it("throws NarratorLinkedToActiveChaptersError when active chapters are present", async () => {
      const { narrator: created } = await service.create({ name: "Ana" });

      await expect(
        service.softDelete(created.id, {
          getActiveBooks: async () => [
            { id: "book-1", title: "Em produção" },
            { id: "book-2", title: "Outro" },
          ],
        }),
      ).rejects.toBeInstanceOf(NarratorLinkedToActiveChaptersError);

      expect(await repo.findById(created.id)).not.toBeNull();
    });

    it("propagates NarratorNotFoundError when id does not exist", async () => {
      await expect(service.softDelete(crypto.randomUUID())).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });
  });

  describe("delete (hard delete — legacy)", () => {
    it("removes the narrator", async () => {
      const { narrator: created } = await service.create({ name: "Para excluir" });

      await service.delete(created.id);

      const list = await service.list();
      expect(list).toEqual([]);
    });

    it("propagates NarratorNotFoundError when id does not exist", async () => {
      await expect(service.delete(crypto.randomUUID())).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });
  });
});
