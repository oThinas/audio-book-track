import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleStudiosDelete } from "@/app/api/v1/studios/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { StudioNotFoundError } from "@/lib/errors/studio-errors";
import { StudioService } from "@/lib/services/studio-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

const noBlockingBooks = () => ({ getActiveBooks: async () => [] });

describe("handleStudiosDelete", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("throws StudioNotFoundError when the studio does not exist", async () => {
    const request = new Request("http://localhost/api/v1/studios/missing", { method: "DELETE" });

    await expect(
      handleStudiosDelete(request, buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingBooks,
      }),
    ).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me", defaultHourlyRateCents: 8500 });
    const request = new Request(`http://localhost/api/v1/studios/${existing.id}`, {
      method: "DELETE",
    });

    const response = await handleStudiosDelete(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: noBlockingBooks,
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
