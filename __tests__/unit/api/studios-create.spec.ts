import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleStudiosCreate } from "@/app/api/v1/studios/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { StudioNameAlreadyInUseError } from "@/lib/errors/studio-errors";
import { StudioService } from "@/lib/services/studio-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/studios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleStudiosCreate", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("throws StudioNameAlreadyInUseError when the name is duplicate", async () => {
    await repo.create({ name: "Duplicado", defaultHourlyRateCents: 5000 });

    await expect(
      handleStudiosCreate(
        buildRequest({ name: "Duplicado", defaultHourlyRateCents: 9000 }),
        buildContext(),
        { createService: () => service },
      ),
    ).rejects.toBeInstanceOf(StudioNameAlreadyInUseError);
  });

  it("returns 201 with Location header and studio payload on success", async () => {
    const response = await handleStudiosCreate(
      buildRequest({ name: "  Sonora  ", defaultHourlyRateCents: 8500 }),
      buildContext(),
      { createService: () => service },
    );
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
    const min = await handleStudiosCreate(
      buildRequest({ name: "Min", defaultHourlyRateCents: 1 }),
      buildContext(),
      { createService: () => service },
    );
    expect(min.status).toBe(201);

    const max = await handleStudiosCreate(
      buildRequest({ name: "Max", defaultHourlyRateCents: 999999 }),
      buildContext(),
      { createService: () => service },
    );
    expect(max.status).toBe(201);
  });

  it("silently discards unknown keys in the payload", async () => {
    const response = await handleStudiosCreate(
      buildRequest({ name: "Sonora", defaultHourlyRateCents: 8500, extra: "ignored" }),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as { data: Record<string, unknown> };

    expect(response.status).toBe(201);
    expect(body.data).not.toHaveProperty("extra");
  });
});
