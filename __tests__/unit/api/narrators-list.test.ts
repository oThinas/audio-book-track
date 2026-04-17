import { InMemoryNarratorRepository } from "@tests/repositories/in-memory-narrator-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleNarratorsList } from "@/app/api/v1/narrators/route";
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

describe("GET /api/v1/narrators (handleNarratorsList)", () => {
  let repo: InMemoryNarratorRepository;
  let service: NarratorService;

  beforeEach(() => {
    repo = new InMemoryNarratorRepository();
    service = new NarratorService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleNarratorsList(deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: expect.any(String) },
    });
  });

  it("returns 200 with empty array when no narrators exist", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleNarratorsList(deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  it("returns 200 with narrators ordered by createdAt ASC", async () => {
    const first = await repo.create({ name: "João", email: "joao@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await repo.create({ name: "Maria", email: "maria@example.com" });
    await new Promise((resolve) => setTimeout(resolve, 2));
    const third = await repo.create({ name: "Pedro", email: "pedro@example.com" });

    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleNarratorsList(deps);
    const body = (await response.json()) as { data: Array<{ id: string; name: string }> };

    expect(response.status).toBe(200);
    expect(body.data.map((n) => n.id)).toEqual([first.id, second.id, third.id]);
    expect(body.data[0]).toMatchObject({
      id: first.id,
      name: "João",
      email: "joao@example.com",
    });
  });

  it("sets Cache-Control: no-store header", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleNarratorsList(deps);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
