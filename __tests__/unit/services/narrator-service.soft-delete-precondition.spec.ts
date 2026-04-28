import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NarratorLinkedToActiveChaptersError,
  NarratorNotFoundError,
} from "@/lib/errors/narrator-errors";
import { NarratorService } from "@/lib/services/narrator-service";

describe("NarratorService.softDelete — NARRATOR_LINKED_TO_ACTIVE_CHAPTERS precondition", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;
  let narratorId: string;

  beforeEach(async () => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
    const { narrator } = await service.create({ name: "Ana Silva" });
    narratorId = narrator.id;
  });

  it("soft-deletes when getActiveBooks returns []", async () => {
    await service.softDelete(narratorId, { getActiveBooks: async () => [] });

    expect(await repo.findById(narratorId)).toBeNull();
    expect(await repo.findByNameIncludingDeleted("Ana Silva")).not.toBeNull();
  });

  it("soft-deletes when no deps are provided (default = no precondition)", async () => {
    await service.softDelete(narratorId);

    expect(await repo.findById(narratorId)).toBeNull();
  });

  it("throws NarratorLinkedToActiveChaptersError when ≥ 1 blocking book is returned", async () => {
    const blocking = [{ id: "book-1", title: "Em revisão" }];

    await expect(
      service.softDelete(narratorId, { getActiveBooks: async () => blocking }),
    ).rejects.toBeInstanceOf(NarratorLinkedToActiveChaptersError);

    expect(await repo.findById(narratorId)).not.toBeNull();
  });

  it("error.books exposes the full blocking list in the order received", async () => {
    const blocking = [
      { id: "book-1", title: "Livro 1" },
      { id: "book-2", title: "Livro 2" },
      { id: "book-3", title: "Livro 3" },
    ];

    try {
      await service.softDelete(narratorId, { getActiveBooks: async () => blocking });
      throw new Error("expected NarratorLinkedToActiveChaptersError");
    } catch (error) {
      expect(error).toBeInstanceOf(NarratorLinkedToActiveChaptersError);
      const narratorError = error as NarratorLinkedToActiveChaptersError;
      expect(narratorError.books).toEqual(blocking);
      expect(narratorError.books).toHaveLength(3);
    }
  });

  it("invokes getActiveBooks exactly once with the narrator id", async () => {
    let calls = 0;
    let receivedId: string | undefined;
    const getActiveBooks = async (id: string) => {
      calls += 1;
      receivedId = id;
      return [];
    };

    await service.softDelete(narratorId, { getActiveBooks });

    expect(calls).toBe(1);
    expect(receivedId).toBe(narratorId);
  });

  it("propagates NarratorNotFoundError when the narrator does not exist", async () => {
    await expect(
      service.softDelete(crypto.randomUUID(), { getActiveBooks: async () => [] }),
    ).rejects.toBeInstanceOf(NarratorNotFoundError);
  });
});
