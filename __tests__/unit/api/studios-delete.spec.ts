import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStudiosDelete } from "@/app/api/v1/studios/[id]/route";
import { StudioService } from "@/lib/services/studio-service";

function createDeps(options: { session: { user: { id: string } } | null; service: StudioService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
    createSoftDeleteDeps: () => ({ getActiveBooks: async () => [] }),
  };
}

describe("DELETE /api/v1/studios/:id (handleStudiosDelete)", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleStudiosDelete(deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the studio does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleStudiosDelete(deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("STUDIO_NOT_FOUND");
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const response = await handleStudiosDelete(deps, { id: existing.id });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
