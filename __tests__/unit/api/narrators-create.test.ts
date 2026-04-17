import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleNarratorsCreate } from "@/app/api/v1/narrators/route";
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

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/narrators", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/narrators (handleNarratorsCreate)", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });
    const request = buildRequest({ name: "João", email: "joao@example.com" });

    const response = await handleNarratorsCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 422 with details when body is invalid", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "a", email: "not-an-email" });

    const response = await handleNarratorsCreate(request, deps);
    const body = (await response.json()) as {
      error: { code: string; details: Array<{ field: string; message: string }> };
    };

    expect(response.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details.some((d) => d.field === "name")).toBe(true);
    expect(body.error.details.some((d) => d.field === "email")).toBe(true);
  });

  it("returns 409 when e-mail is already in use", async () => {
    await repo.create({ name: "Existing", email: "dup@example.com" });
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "Another", email: "dup@example.com" });

    const response = await handleNarratorsCreate(request, deps);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("EMAIL_ALREADY_IN_USE");
  });

  it("returns 201 with Location header and narrator payload on success", async () => {
    const deps = createDeps({ session: { user: { id: "u1" } }, service });
    const request = buildRequest({ name: "  João Silva ", email: "  JOAO@Example.com " });

    const response = await handleNarratorsCreate(request, deps);
    const body = (await response.json()) as {
      data: { id: string; name: string; email: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("João Silva");
    expect(body.data.email).toBe("joao@example.com");
    expect(response.headers.get("Location")).toBe(`/api/v1/narrators/${body.data.id}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
