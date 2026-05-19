import { InMemoryDashboardRepository } from "@tests/repositories/in-memory-dashboard-repository";
import { describe, expect, it } from "vitest";

import type { DateRangeIso } from "@/lib/domain/dashboard-period";
import { DashboardService } from "@/lib/services/dashboard-service";

const PERIOD: DateRangeIso = {
  fromIso: "2026-05-01",
  toIso: "2026-05-31",
  preset: "this-month",
};

describe("DashboardService.getFinancial", () => {
  it("returns only 'a-receber-agora' when scoped, zeroes the rest", async () => {
    const repo = new InMemoryDashboardRepository({
      aReceberAgoraCents: 9999,
      receitaPeriodoCents: 12345,
      chaptersPagosCount: 4,
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getFinancial(PERIOD, ["a-receber-agora"]);

    expect(snapshot.aReceberAgoraCents).toBe(9999);
    expect(snapshot.receitaPeriodoCents).toBe(0);
    expect(snapshot.ticketMedioCents).toBe(0);
    expect(snapshot.chaptersPagosCount).toBe(0);
    expect(snapshot.rankingEstudio).toEqual([]);
    expect(snapshot.rankingNarrador).toEqual([]);
    expect(snapshot.rankingEditor).toEqual([]);
    expect(snapshot.computedWidgets).toEqual(["a-receber-agora"]);
    expect(snapshot.periodo).toEqual(PERIOD);

    expect(repo.calls.receitaPeriodoCents).toBe(0);
    expect(repo.calls.rankingByStudio).toBe(0);
  });

  it("computes receitaPeriodoCents and chaptersPagosCount when widget is enabled", async () => {
    const repo = new InMemoryDashboardRepository({
      receitaPeriodoCents: 50000,
      chaptersPagosCount: 5,
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getFinancial(PERIOD, ["receita-periodo"]);

    expect(snapshot.receitaPeriodoCents).toBe(50000);
    expect(snapshot.chaptersPagosCount).toBe(5);
    expect(snapshot.computedWidgets).toContain("receita-periodo");
  });

  it("computes all widgets when enabledWidgets is undefined", async () => {
    const repo = new InMemoryDashboardRepository({
      aReceberAgoraCents: 1000,
      receitaPeriodoCents: 5000,
      chaptersPagosCount: 2,
      rankingByStudio: [
        {
          entityId: "s1",
          name: "Studio A",
          archived: false,
          chaptersPaidCount: 2,
          totalCents: 5000,
        },
      ],
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getFinancial(PERIOD);

    expect(snapshot.aReceberAgoraCents).toBe(1000);
    expect(snapshot.receitaPeriodoCents).toBe(5000);
    expect(snapshot.chaptersPagosCount).toBe(2);
    expect(snapshot.rankingEstudio).toHaveLength(1);
    expect(snapshot.computedWidgets).toHaveLength(6);
  });
});
