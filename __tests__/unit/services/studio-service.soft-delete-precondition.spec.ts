import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { StudioHasActiveBooksError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import { StudioService } from "@/lib/services/studio-service";

describe("StudioService.softDelete — STUDIO_HAS_ACTIVE_BOOKS precondition", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;
  let studioId: string;

  beforeEach(async () => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
    const { studio } = await service.create({
      name: "Sonora",
      defaultHourlyRateCents: 8500,
    });
    studioId = studio.id;
  });

  it("soft-deletes when getActiveBooks returns an empty list", async () => {
    await service.softDelete(studioId, { getActiveBooks: async () => [] });

    expect(await repo.findById(studioId)).toBeNull();
    expect(await repo.findByNameIncludingDeleted("Sonora")).not.toBeNull();
  });

  it("soft-deletes when no deps are provided (default = no precondition)", async () => {
    await service.softDelete(studioId);

    expect(await repo.findById(studioId)).toBeNull();
  });

  it("throws StudioHasActiveBooksError when getActiveBooks returns ≥ 1 blocking book", async () => {
    const blocking = [{ id: "book-1", title: "Em produção" }];

    await expect(
      service.softDelete(studioId, { getActiveBooks: async () => blocking }),
    ).rejects.toBeInstanceOf(StudioHasActiveBooksError);

    // estúdio NÃO foi soft-deletado
    expect(await repo.findById(studioId)).not.toBeNull();
  });

  it("error.books expõe a lista completa de livros bloqueando, na ordem recebida", async () => {
    const blocking = [
      { id: "book-1", title: "Livro 1" },
      { id: "book-2", title: "Livro 2" },
      { id: "book-3", title: "Livro 3" },
    ];

    try {
      await service.softDelete(studioId, { getActiveBooks: async () => blocking });
      throw new Error("expected StudioHasActiveBooksError to be thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(StudioHasActiveBooksError);
      const studioError = error as StudioHasActiveBooksError;
      expect(studioError.books).toEqual(blocking);
      expect(studioError.books).toHaveLength(3);
    }
  });

  it("invokes getActiveBooks exactly once with the studio id", async () => {
    let calls = 0;
    let receivedId: string | undefined;
    const getActiveBooks = async (id: string) => {
      calls += 1;
      receivedId = id;
      return [];
    };

    await service.softDelete(studioId, { getActiveBooks });

    expect(calls).toBe(1);
    expect(receivedId).toBe(studioId);
  });

  it("propagates StudioNotFoundError when the studio does not exist", async () => {
    await expect(
      service.softDelete("non-existent-id", { getActiveBooks: async () => [] }),
    ).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  it("does NOT call getActiveBooks again after blocking (no retry)", async () => {
    let calls = 0;
    const getActiveBooks = async () => {
      calls += 1;
      return [{ id: "b", title: "Bloqueio" }];
    };

    await expect(service.softDelete(studioId, { getActiveBooks })).rejects.toBeInstanceOf(
      StudioHasActiveBooksError,
    );

    expect(calls).toBe(1);
  });
});
