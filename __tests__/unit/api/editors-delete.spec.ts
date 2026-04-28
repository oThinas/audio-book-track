import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEditorsDelete } from "@/app/api/v1/editors/[id]/route";
import { EditorService } from "@/lib/services/editor-service";

function createDeps(options: { session: { user: { id: string } } | null; service: EditorService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({ getActiveBooks: async () => [] }),
  };
}

describe("DELETE /api/v1/editors/:id (handleEditorsDelete)", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleEditorsDelete(deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the editor does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleEditorsDelete(deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("EDITOR_NOT_FOUND");
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me", email: "del@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleEditorsDelete(deps, { id: existing.id });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
