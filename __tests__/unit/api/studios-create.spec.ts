import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStudiosCreate } from "@/app/api/v1/studios/route";
import { StudioService } from "@/lib/services/studio-service";

function createDeps(options: { session: { user: { id: string } } | null; service: StudioService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/studios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/studios (handleStudiosCreate)", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 8500 });

    const response = await handleStudiosCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 422 when name is too short", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a", defaultHourlyRateCents: 8500 });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
  });

  it("returns 422 when defaultHourlyRateCents is below minimum (0)", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 0 });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.some((d) => d.field === "defaultHourlyRateCents")).toBe(true);
  });

  it("returns 422 when defaultHourlyRateCents exceeds maximum (1000000)", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 1000000 });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.details.some((d) => d.field === "defaultHourlyRateCents")).toBe(true);
  });

  it("returns 422 when defaultHourlyRateCents is not an integer", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 85.5 });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.details.some((d) => d.field === "defaultHourlyRateCents")).toBe(true);
  });

  it("returns 422 when defaultHourlyRateCents is missing", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Sonora" });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.details.some((d) => d.field === "defaultHourlyRateCents")).toBe(true);
  });

  it("returns 409 NAME_ALREADY_IN_USE when name is duplicate", async () => {
    await repo.create({ name: "Duplicado", defaultHourlyRateCents: 5000 });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Duplicado", defaultHourlyRateCents: 9000 });

    const response = await handleStudiosCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("NAME_ALREADY_IN_USE");
  });

  it("returns 201 with Location header and studio payload on success", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  Sonora  ", defaultHourlyRateCents: 8500 });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(8500);
    expect(response.headers.get("Location")).toBe(`/api/v1/studios/${body.data.id}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("accepts boundary values (1 and 999999)", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });

    const min = await handleStudiosCreate(
      buildRequest({ name: "Min", defaultHourlyRateCents: 1 }),
      deps,
    );
    expect(min.status).toBe(201);

    const max = await handleStudiosCreate(
      buildRequest({ name: "Max", defaultHourlyRateCents: 999999 }),
      deps,
    );
    expect(max.status).toBe(201);
  });

  it("silently discards unknown keys in the payload", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({
      name: "Sonora",
      defaultHourlyRateCents: 8500,
      extra: "ignored",
    });

    const response = await handleStudiosCreate(request, deps);
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.data).not.toHaveProperty("extra");
  });
});
