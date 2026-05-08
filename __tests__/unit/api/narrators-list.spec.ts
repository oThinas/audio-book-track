import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleNarratorsList } from "@/app/api/v1/narrators/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { NarratorService } from "@/lib/services/narrator-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

describe("handleNarratorsList", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("returns 200 with empty array when no narrators exist", async () => {
    const request = new Request("http://localhost/api/v1/narrators");
    const response = await handleNarratorsList(request, buildContext(), {
      createService: () => service,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  it("returns 200 with narrators ordered by createdAt ASC", async () => {
    const first = await repo.create({ name: "João" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.create({ name: "Maria" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const third = await repo.create({ name: "Pedro" });

    const request = new Request("http://localhost/api/v1/narrators");
    const response = await handleNarratorsList(request, buildContext(), {
      createService: () => service,
    });
    const body = (await response.json()) as { data: Array<{ id: string; name: string }> };

    expect(response.status).toBe(200);
    expect(body.data.map((n) => n.id)).toEqual([first.id, second.id, third.id]);
    expect(body.data[0]).toMatchObject({ id: first.id, name: "João" });
    expect(body.data[0]).not.toHaveProperty("email");
  });

  it("sets Cache-Control: no-store header", async () => {
    const request = new Request("http://localhost/api/v1/narrators");
    const response = await handleNarratorsList(request, buildContext(), {
      createService: () => service,
    });

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
