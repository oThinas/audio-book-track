import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEditorsCreate } from "@/app/api/v1/editors/route";
import { EditorService } from "@/lib/services/editor-service";

function createDeps(options: { session: { user: { id: string } } | null; service: EditorService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/editors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/editors (handleEditorsCreate)", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "Carla", email: "c@s.com" });

    const response = await handleEditorsCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 422 with details when name is too short", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a", email: "c@s.com" });

    const response = await handleEditorsCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
  });

  it("returns 422 with details when email is malformed", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Carla", email: "not-an-email" });

    const response = await handleEditorsCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "email")).toBe(true);
  });

  it("returns 409 NAME_ALREADY_IN_USE when name is duplicate", async () => {
    await repo.create({ name: "Duplicado", email: "a@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Duplicado", email: "b@s.com" });

    const response = await handleEditorsCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("NAME_ALREADY_IN_USE");
  });

  it("returns 409 EMAIL_ALREADY_IN_USE when email is duplicate (case-insensitive)", async () => {
    await repo.create({ name: "Primeiro", email: "same@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Segundo", email: "SAME@S.COM" });

    const response = await handleEditorsCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("EMAIL_ALREADY_IN_USE");
  });

  it("returns 201 with Location header and editor payload on success", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  Carla Mendes  ", email: "  Carla@Studio.com  " });

    const response = await handleEditorsCreate(request, deps);
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
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Carla", email: "c@s.com", extra: "ignored" });

    const response = await handleEditorsCreate(request, deps);
    const body = (await response.json()) as {
      data: Record<string, unknown>;
    };

    expect(response.status).toBe(201);
    expect(body.data).not.toHaveProperty("extra");
  });
});
