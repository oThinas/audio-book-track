import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStudiosUpdate } from "@/app/api/v1/studios/[id]/route";
import { StudioService } from "@/lib/services/studio-service";

function createDeps(options: { session: { user: { id: string } } | null; service: StudioService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/studios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/studios/:id (handleStudiosUpdate)", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "Novo" }, "some-id");

    const response = await handleStudiosUpdate(request, deps, { id: "some-id" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when the studio does not exist", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Novo" }, "missing");

    const response = await handleStudiosUpdate(request, deps, { id: "missing" });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("STUDIO_NOT_FOUND");
  });

  it("returns 422 with details when name is too short", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a" }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
  });

  it("returns 422 when defaultHourlyRateCents is out of range", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ defaultHourlyRateCents: 0 }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.details.some((d) => d.field === "defaultHourlyRateCents")).toBe(true);
  });

  it("returns 409 NAME_ALREADY_IN_USE when renaming to another studio's name", async () => {
    const first = await repo.create({ name: "First", defaultHourlyRateCents: 5000 });
    await repo.create({ name: "Second", defaultHourlyRateCents: 6000 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Second" }, first.id);

    const response = await handleStudiosUpdate(request, deps, { id: first.id });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("NAME_ALREADY_IN_USE");
  });

  it("returns 200 updating only the name (partial, trimmed)", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  Novo Nome  " }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo Nome");
    expect(body.data.defaultHourlyRateCents).toBe(8500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 200 updating only the defaultHourlyRateCents (partial)", async () => {
    const existing = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ defaultHourlyRateCents: 12050 }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(12050);
  });

  it("returns 200 updating both fields", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Novo", defaultHourlyRateCents: 9999 }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo");
    expect(body.data.defaultHourlyRateCents).toBe(9999);
  });

  it("returns 200 when body is empty (idempotent no-op)", async () => {
    const existing = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({}, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(8500);
  });

  it("returns 200 when PATCH keeps the same name (idempotent, no self-conflict)", async () => {
    const existing = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 8500 }, existing.id);

    const response = await handleStudiosUpdate(request, deps, { id: existing.id });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(8500);
  });
});
