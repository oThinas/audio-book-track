import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleNarratorsDelete } from "@/app/api/v1/narrators/[id]/route";
import { NarratorService } from "@/lib/services/narrator-service";

function createDeps(options: {
  session: { user: { id: string } } | null;
  service: NarratorService;
}) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({ getActiveBooks: async () => [] }),
  };
}

describe("DELETE /api/v1/narrators/:id (handleNarratorsDelete)", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleNarratorsDelete(deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the narrator does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleNarratorsDelete(deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NARRATOR_NOT_FOUND");
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleNarratorsDelete(deps, { id: existing.id });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
