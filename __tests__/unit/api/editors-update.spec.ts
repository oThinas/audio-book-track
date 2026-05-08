import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleEditorsUpdate } from "@/app/api/v1/editors/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import { EditorService } from "@/lib/services/editor-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/editors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const noBlockingDeps = () => ({ getActiveBooks: async () => [] });

describe("handleEditorsUpdate", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("throws EditorNotFoundError when the editor does not exist", async () => {
    await expect(
      handleEditorsUpdate(buildRequest({ name: "Novo" }, "missing"), buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(EditorNotFoundError);
  });

  it("throws EditorNameAlreadyInUseError when renaming to another editor's name", async () => {
    const first = await repo.create({ name: "First", email: "1@s.com" });
    await repo.create({ name: "Second", email: "2@s.com" });

    await expect(
      handleEditorsUpdate(buildRequest({ name: "Second" }, first.id), buildContext(first.id), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(EditorNameAlreadyInUseError);
  });

  it("throws EditorEmailAlreadyInUseError when re-emailing to another editor's email", async () => {
    const first = await repo.create({ name: "First", email: "1@s.com" });
    await repo.create({ name: "Second", email: "2@s.com" });

    await expect(
      handleEditorsUpdate(buildRequest({ email: "2@s.com" }, first.id), buildContext(first.id), {
        createService: () => service,
        createSoftDeleteDeps: noBlockingDeps,
      }),
    ).rejects.toBeInstanceOf(EditorEmailAlreadyInUseError);
  });

  it("returns 200 updating only the name (partial)", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });

    const response = await handleEditorsUpdate(
      buildRequest({ name: "  Novo Nome  " }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo Nome");
    expect(body.data.email).toBe("orig@s.com");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 updating only the email (partial, normalized)", async () => {
    const existing = await repo.create({ name: "Carla", email: "orig@s.com" });

    const response = await handleEditorsUpdate(
      buildRequest({ email: "  Novo@S.COM  " }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Carla");
    expect(body.data.email).toBe("novo@s.com");
  });

  it("returns 200 updating both fields", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });

    const response = await handleEditorsUpdate(
      buildRequest({ name: "Novo", email: "novo@s.com" }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo");
    expect(body.data.email).toBe("novo@s.com");
  });

  it("returns 200 when PATCH keeps the same normalized email (idempotent)", async () => {
    const existing = await repo.create({ name: "Carla", email: "carla@s.com" });

    const response = await handleEditorsUpdate(
      buildRequest({ email: "Carla@S.COM" }, existing.id),
      buildContext(existing.id),
      { createService: () => service, createSoftDeleteDeps: noBlockingDeps },
    );
    const body = (await response.json()) as { data: { id: string; email: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.email).toBe("carla@s.com");
  });
});
