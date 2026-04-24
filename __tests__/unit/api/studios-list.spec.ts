import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { handleStudiosList } from "@/app/api/v1/studios/route";
import { StudioService } from "@/lib/services/studio-service";

function createDeps(options: { session: { user: { id: string } } | null; service: StudioService }) {
  return {
    getSession: vi.fn().mockResolvedValue(options.session),
    createService: vi.fn().mockReturnValue(options.service),
    headersFn: vi.fn().mockResolvedValue(new Headers()),
  };
}

describe("GET /api/v1/studios (handleStudiosList)", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("returns 401 when there is no session", async () => {
    const deps = createDeps({ session: null, service });

    const response = await handleStudiosList(deps);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: expect.any(String) },
    });
  });

  it("returns 200 with empty array when no studios exist", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleStudiosList(deps);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  it("returns 200 with studios payload including integer defaultHourlyRateCents", async () => {
    const first = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const second = await repo.create({ name: "Voz & Arte", defaultHourlyRateCents: 9050 });

    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleStudiosList(deps);
    const body = (await response.json()) as {
      data: Array<{ id: string; name: string; defaultHourlyRateCents: number }>;
    };

    expect(response.status).toBe(200);
    expect(body.data.map((s) => s.id).sort()).toEqual([first.id, second.id].sort());
    const sonora = body.data.find((s) => s.name === "Sonora");
    const vozArte = body.data.find((s) => s.name === "Voz & Arte");
    expect(sonora?.defaultHourlyRateCents).toBe(8500);
    expect(vozArte?.defaultHourlyRateCents).toBe(9050);
  });

  it("sets Cache-Control: no-store header", async () => {
    const deps = createDeps({ session: { user: { id: "user-1" } }, service });

    const response = await handleStudiosList(deps);

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
