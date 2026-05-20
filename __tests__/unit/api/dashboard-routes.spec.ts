import { InMemoryDashboardRepository } from "@tests/repositories/in-memory-dashboard-repository";
import { describe, expect, it } from "vitest";

import { handleDashboardFinancial } from "@/app/api/v1/dashboard/financial/route";
import type { AuthenticatedContext } from "@/lib/api/with-error-handler";
import {
  DashboardInvalidPeriodError,
  DashboardWidgetsInvalidKeyError,
} from "@/lib/errors/dashboard-errors";
import { DashboardService } from "@/lib/services/dashboard-service";

function buildContext(): AuthenticatedContext<Record<string, never>> {
  return {
    params: Promise.resolve({}),
    session: { user: { id: crypto.randomUUID() } },
    requestId: "test-request-id",
  };
}

function buildDeps(overrides?: { aReceberAgoraCents?: number }) {
  const repo = new InMemoryDashboardRepository(overrides ?? {});
  const service = new DashboardService(repo);
  return {
    repo,
    deps: {
      createService: () => service,
      today: () => "2026-05-19",
    },
  };
}

describe("handleDashboardFinancial", () => {
  it("returns 200 with snapshot for default period (this-month)", async () => {
    const { deps } = buildDeps({ aReceberAgoraCents: 9999 });
    const response = await handleDashboardFinancial(
      new Request("http://localhost/api/v1/dashboard/financial"),
      buildContext(),
      deps,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: { aReceberAgoraCents: number; periodo: { preset: string } };
    };
    expect(body.data.aReceberAgoraCents).toBe(9999);
    expect(body.data.periodo.preset).toBe("this-month");
  });

  it("sets Cache-Control: no-store", async () => {
    const { deps } = buildDeps();
    const response = await handleDashboardFinancial(
      new Request("http://localhost/api/v1/dashboard/financial"),
      buildContext(),
      deps,
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects from > to with DashboardInvalidPeriodError", async () => {
    const { deps } = buildDeps();
    await expect(
      handleDashboardFinancial(
        new Request("http://localhost/api/v1/dashboard/financial?from=2026-05-31&to=2026-05-01"),
        buildContext(),
        deps,
      ),
    ).rejects.toThrow(DashboardInvalidPeriodError);
  });

  it("rejects unknown widget key with DashboardWidgetsInvalidKeyError", async () => {
    const { deps } = buildDeps();
    await expect(
      handleDashboardFinancial(
        new Request("http://localhost/api/v1/dashboard/financial?widgets=a-receber-agora,bogus"),
        buildContext(),
        deps,
      ),
    ).rejects.toThrow(DashboardWidgetsInvalidKeyError);
  });

  it("only computes widgets listed in CSV (optimization FR-032)", async () => {
    const { deps, repo } = buildDeps({ aReceberAgoraCents: 1000 });
    await handleDashboardFinancial(
      new Request("http://localhost/api/v1/dashboard/financial?widgets=a-receber-agora"),
      buildContext(),
      deps,
    );
    expect(repo.calls.aReceberAgoraCents).toBe(1);
    expect(repo.calls.receitaPeriodoCents).toBe(0);
    expect(repo.calls.rankingByStudio).toBe(0);
  });
});
