import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleNarratorsCreate } from "@/app/api/v1/narrators/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { NarratorNameAlreadyInUseError } from "@/lib/errors/narrator-errors";
import { NarratorService } from "@/lib/services/narrator-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/v1/narrators", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("handleNarratorsCreate", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("throws NarratorNameAlreadyInUseError when the name is already in use", async () => {
    await repo.create({ name: "Duplicado" });

    await expect(
      handleNarratorsCreate(buildRequest({ name: "Duplicado" }), buildContext(), {
        createService: () => service,
      }),
    ).rejects.toBeInstanceOf(NarratorNameAlreadyInUseError);
  });

  it("returns 201 with Location header and narrator payload on success", async () => {
    const response = await handleNarratorsCreate(
      buildRequest({ name: "  João Silva " }),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as { data: { id: string; name: string } };

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("João Silva");
    expect(body.data).not.toHaveProperty("email");
    expect(response.headers.get("Location")).toBe(`/api/v1/narrators/${body.data.id}`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("returns 201 and silently discards an extra email field", async () => {
    const response = await handleNarratorsCreate(
      buildRequest({ name: "João", email: "legacy@example.com" }),
      buildContext(),
      { createService: () => service },
    );
    const body = (await response.json()) as {
      data: { id: string; name: string; email?: string };
    };

    expect(response.status).toBe(201);
    expect(body.data.name).toBe("João");
    expect(body.data).not.toHaveProperty("email");
  });
});
