import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
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
      const first = await service.create({ name: "Primeiro" });
      const second = await service.create({ name: "Segundo" });

      const result = await service.list();

      expect(result.map((n) => n.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates a narrator with the provided name", async () => {
      const created = await service.create({ name: "João" });

      expect(created.name).toBe("João");
      expect(created.id).toEqual(expect.any(String));
      expect(created).not.toHaveProperty("email");
    });

    it("propagates NarratorNameAlreadyInUseError on duplicate name", async () => {
      await service.create({ name: "Duplicado" });

      await expect(service.create({ name: "Duplicado" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });
  });

  describe("update", () => {
    it("updates the name", async () => {
      const created = await service.create({ name: "Original" });

      const updated = await service.update(created.id, { name: "Atualizado" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Atualizado");
    });

    it("is idempotent when renaming to the same name", async () => {
      const created = await service.create({ name: "Mesmo Nome" });

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
      const second = await service.create({ name: "Segundo" });

      await expect(service.update(second.id, { name: "Primeiro" })).rejects.toBeInstanceOf(
        NarratorNameAlreadyInUseError,
      );
    });
  });

  describe("delete", () => {
    it("removes the narrator", async () => {
      const created = await service.create({ name: "Para excluir" });

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
