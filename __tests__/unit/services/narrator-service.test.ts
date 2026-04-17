import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NarratorEmailAlreadyInUseError,
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
      const first = await service.create({ name: "Primeiro", email: "a@exemplo.com" });
      const second = await service.create({ name: "Segundo", email: "b@exemplo.com" });

      const result = await service.list();

      expect(result.map((n) => n.id)).toEqual([first.id, second.id]);
    });
  });

  describe("create", () => {
    it("creates a narrator with the provided values", async () => {
      const created = await service.create({ name: "João", email: "joao@exemplo.com" });

      expect(created.name).toBe("João");
      expect(created.email).toBe("joao@exemplo.com");
      expect(created.id).toEqual(expect.any(String));
    });

    it("propagates NarratorEmailAlreadyInUseError on duplicate email", async () => {
      await service.create({ name: "Primeiro", email: "dup@exemplo.com" });

      await expect(
        service.create({ name: "Segundo", email: "dup@exemplo.com" }),
      ).rejects.toBeInstanceOf(NarratorEmailAlreadyInUseError);
    });
  });

  describe("update", () => {
    it("updates a single field (name)", async () => {
      const created = await service.create({ name: "Original", email: "orig@exemplo.com" });

      const updated = await service.update(created.id, { name: "Atualizado" });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Atualizado");
      expect(updated.email).toBe("orig@exemplo.com");
    });

    it("updates a single field (email)", async () => {
      const created = await service.create({ name: "João", email: "joao@exemplo.com" });

      const updated = await service.update(created.id, { email: "novo@exemplo.com" });

      expect(updated.name).toBe("João");
      expect(updated.email).toBe("novo@exemplo.com");
    });

    it("updates both fields", async () => {
      const created = await service.create({ name: "João", email: "joao@exemplo.com" });

      const updated = await service.update(created.id, {
        name: "João Santos",
        email: "santos@exemplo.com",
      });

      expect(updated.name).toBe("João Santos");
      expect(updated.email).toBe("santos@exemplo.com");
    });

    it("propagates NarratorNotFoundError when id does not exist", async () => {
      await expect(service.update(crypto.randomUUID(), { name: "X" })).rejects.toBeInstanceOf(
        NarratorNotFoundError,
      );
    });

    it("propagates NarratorEmailAlreadyInUseError when email is taken", async () => {
      await service.create({ name: "Primeiro", email: "first@exemplo.com" });
      const second = await service.create({ name: "Segundo", email: "second@exemplo.com" });

      await expect(
        service.update(second.id, { email: "first@exemplo.com" }),
      ).rejects.toBeInstanceOf(NarratorEmailAlreadyInUseError);
    });
  });

  describe("delete", () => {
    it("removes the narrator", async () => {
      const created = await service.create({ name: "João", email: "joao@exemplo.com" });

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
