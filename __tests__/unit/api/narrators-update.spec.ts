import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleNarratorsUpdate } from "@/app/api/v1/narrators/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { NarratorService } from "@/lib/services/narrator-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/narrators/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const noBlockingDeps = () => ({ getActiveBooks: async () => [] });

describe("handleNarratorsUpdate", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("throws NarratorNotFoundError when the narrator does not exist", async () => {
    await expect(
      handleNarratorsUpdate(buildRequest({ name: "Novo" }, "missing"), buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(NarratorNotFoundError);
  });

  it("throws NarratorNameAlreadyInUseError when renaming to another narrator's name", async () => {
    const first = await repo.create({ name: "First" });
    await repo.create({ name: "Second" });

    await expect(
      handleNarratorsUpdate(buildRequest({ name: "Second" }, first.id), buildContext(first.id), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(NarratorNameAlreadyInUseError);
  });

  it("returns 200 when PATCH keeps the same name (idempotent)", async () => {
    const existing = await repo.create({ name: "Mesmo" });

    const response = await handleNarratorsUpdate(
      buildRequest({ name: "Mesmo" }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Mesmo");
  });

  it("returns 200 updating the name (with trim)", async () => {
    const existing = await repo.create({ name: "Original" });

    const response = await handleNarratorsUpdate(
      buildRequest({ name: "  Novo Nome  " }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Novo Nome");
    expect(body.data).not.toHaveProperty("email");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 and silently ignores an extra email field", async () => {
    const existing = await repo.create({ name: "Original" });

    const response = await handleNarratorsUpdate(
      buildRequest({ name: "Atualizado", email: "legacy@example.com" }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Atualizado");
    expect(body.data).not.toHaveProperty("email");
  });
});
