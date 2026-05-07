import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleEditorsCreate } from "@/app/api/v1/editors/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
} from "@/lib/errors/editor-errors";
import { EditorService } from "@/lib/services/editor-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/editors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleEditorsCreate", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("throws EditorNameAlreadyInUseError when the name is duplicate", async () => {
    await repo.create({ name: "Duplicado", email: "a@s.com" });

    await expect(
      handleEditorsCreate(buildRequest({ name: "Duplicado", email: "b@s.com" }), buildContext(), {
        createService: () => service,
      }),
    ).rejects.toBeInstanceOf(EditorNameAlreadyInUseError);
  });

  it("throws EditorEmailAlreadyInUseError when email collides (case-insensitive)", async () => {
    await repo.create({ name: "Primeiro", email: "same@s.com" });

    await expect(
      handleEditorsCreate(buildRequest({ name: "Segundo", email: "SAME@S.COM" }), buildContext(), {
        createService: () => service,
      }),
    ).rejects.toBeInstanceOf(EditorEmailAlreadyInUseError);
  });

  it("returns 201 with Location header and editor payload on success", async () => {
    const response = await handleEditorsCreate(
      buildRequest({ name: "  Carla Mendes  ", email: "  Carla@Studio.com  " }),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("Carla Mendes");
    expect(body.data.email).toBe("carla@studio.com");
    expect(response.headers.get("Location")).toBe(`/api/v1/editors/${body.data.id}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("silently discards unknown keys in the payload", async () => {
    const response = await handleEditorsCreate(
      buildRequest({ name: "Carla", email: "c@s.com", extra: "ignored" }),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.data).not.toHaveProperty("extra");
  });
});
