import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleNarratorsDelete } from "@/app/api/v1/narrators/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { NarratorService } from "@/lib/services/narrator-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

const noBlockingDeps = () => ({ getActiveBooks: async () => [] });

describe("handleNarratorsDelete", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("throws NarratorNotFoundError when the narrator does not exist", async () => {
    const request = new Request("http://localhost/api/v1/narrators/missing", { method: "DELETE" });

    await expect(
      handleNarratorsDelete(request, buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(NarratorNotFoundError);
  });

  it("returns 204 with no body and Cache-Control no-store on success", async () => {
    const existing = await repo.create({ name: "Delete Me" });
    const request = new Request(`http://localhost/api/v1/narrators/${existing.id}`, {
      method: "DELETE",
    });

    const response = await handleNarratorsDelete(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: noBlockingDeps,
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await repo.findById(existing.id)).toBeNull();
  });
});
