import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { EditorLinkedToActiveChaptersError, EditorNotFoundError } from "@/lib/errors/editor-errors";
import { EditorService } from "@/lib/services/editor-service";

describe("EditorService.softDelete — EDITOR_LINKED_TO_ACTIVE_CHAPTERS precondition", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;
  let editorId: string;

  beforeEach(async () => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
    const { editor } = await service.create({
      name: "Bruno Gomes",
      email: "bruno@example.com",
    });
    editorId = editor.id;
  });

  it("soft-deletes when getActiveBooks returns []", async () => {
    await service.softDelete(editorId, { getActiveBooks: async () => [] });

    expect(await repo.findById(editorId)).toBeNull();
    expect(await repo.findByNameIncludingDeleted("Bruno Gomes")).not.toBeNull();
  });

  it("soft-deletes when no deps are provided (default = no precondition)", async () => {
    await service.softDelete(editorId);

    expect(await repo.findById(editorId)).toBeNull();
  });

  it("throws EditorLinkedToActiveChaptersError when ≥ 1 blocking book is returned", async () => {
    const blocking = [{ id: "book-1", title: "Em revisão" }];

    await expect(
      service.softDelete(editorId, { getActiveBooks: async () => blocking }),
    ).rejects.toBeInstanceOf(EditorLinkedToActiveChaptersError);

    expect(await repo.findById(editorId)).not.toBeNull();
  });

  it("error.books exposes the full blocking list in the order received", async () => {
    const blocking = [
      { id: "book-1", title: "Livro 1" },
      { id: "book-2", title: "Livro 2" },
    ];

    try {
      await service.softDelete(editorId, { getActiveBooks: async () => blocking });
      throw new Error("expected EditorLinkedToActiveChaptersError");
    } catch (error) {
      expect(error).toBeInstanceOf(EditorLinkedToActiveChaptersError);
      const editorError = error as EditorLinkedToActiveChaptersError;
      expect(editorError.books).toEqual(blocking);
      expect(editorError.books).toHaveLength(2);
    }
  });

  it("invokes getActiveBooks exactly once with the editor id", async () => {
    let calls = 0;
    let receivedId: string | undefined;
    const getActiveBooks = async (id: string) => {
      calls += 1;
      receivedId = id;
      return [];
    };

    await service.softDelete(editorId, { getActiveBooks });

    expect(calls).toBe(1);
    expect(receivedId).toBe(editorId);
  });

  it("propagates EditorNotFoundError when the editor does not exist", async () => {
    await expect(
      service.softDelete(crypto.randomUUID(), { getActiveBooks: async () => [] }),
    ).rejects.toBeInstanceOf(EditorNotFoundError);
  });
});
