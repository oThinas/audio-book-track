import { InMemoryStudioRepository } from "@tests/repositories/in-memory-studio-repository";
import { beforeEach, describe, expect, it } from "vitest";

import { handleStudiosList } from "@/app/api/v1/studios/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import { StudioService } from "@/lib/services/studio-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: "u1" } },
    requestId: "test-request-id",
  };
}

describe("handleStudiosList", () => {
  let repo: InMemoryStudioRepository;
  let service: StudioService;

  beforeEach(() => {
    repo = new InMemoryStudioRepository();
    service = new StudioService(repo);
  });

  it("returns 200 with empty array when no studios exist", async () => {
    const response = await handleStudiosList(
      new Request("http://localhost/api/v1/studios"),
      buildContext(),
      { createService: () => service },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [] });
  });

  it("returns 200 with studios payload including integer defaultHourlyRateCents", async () => {
    const first = await repo.create({ name: "Sonora", defaultHourlyRateCents: 8500 });
    const second = await repo.create({ name: "Voz & Arte", defaultHourlyRateCents: 9050 });

    const response = await handleStudiosList(
      new Request("http://localhost/api/v1/studios"),
      buildContext(),
      { createService: () => service },
    );
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
    const response = await handleStudiosList(
      new Request("http://localhost/api/v1/studios"),
      buildContext(),
      { createService: () => service },
    );

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
