import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleNarratorsUpdate } from "@/app/api/v1/narrators/[id]/route";
import { NarratorService } from "@/lib/services/narrator-service";

function createDeps(options: {
  session: { user: { id: string } } | null;
  service: NarratorService;
}) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/narrators/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/narrators/:id (handleNarratorsUpdate)", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "Novo Nome" }, "some-id");

    const response = await handleNarratorsUpdate(request, deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the narrator does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Novo Nome" }, "missing");

    const response = await handleNarratorsUpdate(request, deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NARRATOR_NOT_FOUND");
  });

  it("returns 422 with details when body is invalid", async () => {
    const existing = await repo.create({ name: "Original" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a" }, existing.id);

    const response = await handleNarratorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
  });

  it("returns 409 when the new name is already in use by another narrator", async () => {
    const first = await repo.create({ name: "First" });
    await repo.create({ name: "Second" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Second" }, first.id);

    const response = await handleNarratorsUpdate(request, deps, { id: first.id });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("NAME_ALREADY_IN_USE");
  });

  it("returns 200 when PATCH keeps the same name (idempotent)", async () => {
    const existing = await repo.create({ name: "Mesmo" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Mesmo" }, existing.id);

    const response = await handleNarratorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Mesmo");
  });

  it("returns 200 updating the name (with trim)", async () => {
    const existing = await repo.create({ name: "Original" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  Novo Nome  " }, existing.id);

    const response = await handleNarratorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Novo Nome");
    expect(body.data).not.toHaveProperty("email");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 and silently ignores an extra email field", async () => {
    const existing = await repo.create({ name: "Original" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Atualizado", email: "legacy@example.com" }, existing.id);

    const response = await handleNarratorsUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Atualizado");
    expect(body.data).not.toHaveProperty("email");
  });
});
