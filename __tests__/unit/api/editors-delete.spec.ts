import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleEditorsDelete } from "@/app/api/v1/editors/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { EditorNotFoundError } from "@/lib/errors/editor-errors";
import { EditorService } from "@/lib/services/editor-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

const noBlockingDeps = () => ({ getActiveBooks: async () => [] });

describe("handleEditorsDelete", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("throws EditorNotFoundError when the editor does not exist", async () => {
    const request = new Request("http://localhost/api/v1/editors/missing", { method: "DELETE" });

    await expect(
      handleEditorsDelete(request, buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(EditorNotFoundError);
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me", email: "del@s.com" });
    const request = new Request(`http://localhost/api/v1/editors/${existing.id}`, {
      method: "DELETE",
    });

    const response = await handleEditorsDelete(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: noBlockingDeps,
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
