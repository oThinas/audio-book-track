import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleStudiosUpdate } from "@/app/api/v1/studios/[id]/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import { StudioService } from "@/lib/services/studio-service";

function buildContext(id: string): AuthenticatedContext<{ id: string }> {
  return {
    params: Promise.resolve({ id }),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown, id: string): Request {
  return new Request(`http://localhost/api/v1/studios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleStudiosUpdate", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("throws StudioNotFoundError when the studio does not exist", async () => {
    const request = buildRequest({ name: "Novo" }, "missing");

    await expect(
      handleStudiosUpdate(request, buildContext("missing"), {
        createService: () => service,
        createSoftDeleteDeps: () => ({}) as never,
      }),
    ).rejects.toBeInstanceOf(StudioNotFoundError);
  });

  it("throws StudioNameAlreadyInUseError when renaming to another studio's name", async () => {
    const first = await repo.create({ name: "First", defaultHourlyRateCents: 5000 });
    await repo.create({ name: "Second", defaultHourlyRateCents: 6000 });
    const request = buildRequest({ name: "Second" }, first.id);

    await expect(
      handleStudiosUpdate(request, buildContext(first.id), {
        createService: () => service,
        createSoftDeleteDeps: () => ({}) as never,
      }),
    ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
  });

  it("returns 200 updating only the name (partial, trimmed)", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const request = buildRequest({ name: "  Novo Nome  " }, existing.id);

    const response = await handleStudiosUpdate(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: () => ({}) as never,
    });
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
    const request = buildRequest({ defaultHourlyRateCents: 12050 }, existing.id);

    const response = await handleStudiosUpdate(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: () => ({}) as never,
    });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(12050);
  });

  it("returns 200 updating both fields", async () => {
    const existing = await repo.create({ name: "Original", defaultHourlyRateCents: 8500 });
    const request = buildRequest({ name: "Novo", defaultHourlyRateCents: 9999 }, existing.id);

    const response = await handleStudiosUpdate(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: () => ({}) as never,
    });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.name).toBe("Novo");
    expect(body.data.defaultHourlyRateCents).toBe(9999);
  });

  it("returns 200 when body is empty (idempotent no-op)", async () => {
    const existing = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const request = buildRequest({}, existing.id);

    const response = await handleStudiosUpdate(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: () => ({}) as never,
    });
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
    const request = buildRequest({ name: "Sonora", defaultHourlyRateCents: 8500 }, existing.id);

    const response = await handleStudiosUpdate(request, buildContext(existing.id), {
      createService: () => service,
      createSoftDeleteDeps: () => ({}) as never,
    });
    const body = (await response.json()) as {
      data: { id: string; name: string; defaultHourlyRateCents: number };
    };

    expect(response.status).toBe(200);
    expect(body.data.id).toBe(existing.id);
    expect(body.data.name).toBe("Sonora");
    expect(body.data.defaultHourlyRateCents).toBe(8500);
  });
});
