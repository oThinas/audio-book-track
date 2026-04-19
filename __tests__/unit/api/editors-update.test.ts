import { InMemoryEditorRepository } from "@tests/repositories/in-memory-editor-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleEditorsUpdate } from "@/app/api/v1/editors/[id]/route";
import { EditorService } from "@/lib/services/editor-service";

function createDeps(options: { session: { user: { id: string } } | null; service: EditorService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/editors/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/editors/:id (handleEditorsUpdate)", () => {
  let repo: InMemoryEditorRepository;
  let service: EditorService;

  beforeEach(() => {
    repo = new InMemoryEditorRepository();
    service = new EditorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "Novo" }, "some-id");

    const response = await handleEditorsUpdate(request, deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the editor does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Novo" }, "missing");

    const response = await handleEditorsUpdate(request, deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("EDITOR_NOT_FOUND");
  });

  it("returns 422 with details when body is invalid (name)", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a" }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
  });

  it("returns 422 with details when body is invalid (email)", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ email: "not-an-email" }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "email")).toBe(true);
  });

  it("returns 409 NAME_ALREADY_IN_USE when renaming to another editor's name", async () => {
    const first = await repo.create({ name: "First", email: "1@s.com" });
    await repo.create({ name: "Second", email: "2@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Second" }, first.id);

    const response = await handleEditorsUpdate(request, deps, { id: first.id });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("NAME_ALREADY_IN_USE");
  });

  it("returns 409 EMAIL_ALREADY_IN_USE when re-emailing to another editor's email", async () => {
    const first = await repo.create({ name: "First", email: "1@s.com" });
    await repo.create({ name: "Second", email: "2@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ email: "2@s.com" }, first.id);

    const response = await handleEditorsUpdate(request, deps, { id: first.id });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("EMAIL_ALREADY_IN_USE");
  });

  it("returns 200 updating only the name (partial)", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  Novo Nome  " }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
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
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ email: "  Novo@S.COM  " }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Carla");
    expect(body.data.email).toBe("novo@s.com");
  });

  it("returns 200 updating both fields", async () => {
    const existing = await repo.create({ name: "Original", email: "orig@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Novo", email: "novo@s.com" }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo");
    expect(body.data.email).toBe("novo@s.com");
  });

  it("returns 200 when PATCH keeps the same normalized email (idempotent)", async () => {
    const existing = await repo.create({ name: "Carla", email: "carla@s.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ email: "Carla@S.COM" }, existing.id);

    const response = await handleEditorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as { data: { id: string; email: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.email).toBe("carla@s.com");
  });
});
