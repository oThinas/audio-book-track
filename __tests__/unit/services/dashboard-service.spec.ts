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

  it("computes funnel and overdue when both widgets enabled", async () => {
    const repo = new InMemoryDashboardRepository({
      funnel: { pending: 3, editing: 2 },
      overdue: { overdueCount: 4, firstOverdueBookId: "book-1" },
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getOperational(["funil-status", "atrasados"]);
    expect(snapshot.funnel.pending).toBe(3);
    expect(snapshot.funnel.editing).toBe(2);
    expect(snapshot.overdueCount).toBe(4);
    expect(snapshot.firstOverdueBookId).toBe("book-1");
    expect(snapshot.computedWidgets).toEqual(["funil-status", "atrasados"]);
  });

  it("skips funnel query when only 'atrasados' is enabled", async () => {
    const repo = new InMemoryDashboardRepository({
      overdue: { overdueCount: 1, firstOverdueBookId: "book-2" },
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getOperational(["atrasados"]);
    expect(snapshot.overdueCount).toBe(1);
    expect(snapshot.funnel.pending).toBe(0);
    expect(repo.calls.statusFunnel).toBe(0);
    expect(repo.calls.overdueSummary).toBe(1);
  });

  it("getRetrospective densifies buckets with zero for missing entries", async () => {
    const repo = new InMemoryDashboardRepository({
      revenueBuckets: [{ startIso: "2026-05-10", cents: 7500 }],
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getRetrospective(PERIOD, ["grafico-receita"]);
    expect(snapshot.granularity).toBe("day");
    expect(snapshot.buckets.length).toBeGreaterThan(0);
    const populated = snapshot.buckets.find((b) => b.startIso === "2026-05-10");
    expect(populated?.cents).toBe(7500);
    const zeroed = snapshot.buckets.find((b) => b.startIso === "2026-05-01");
    expect(zeroed?.cents).toBe(0);
    expect(snapshot.computedWidgets).toEqual(["grafico-receita"]);
  });

  it("getRetrospective returns empty buckets when widget is disabled", async () => {
    const repo = new InMemoryDashboardRepository({
      revenueBuckets: [{ startIso: "2026-05-10", cents: 7500 }],
    });
    const service = new DashboardService(repo);

    const snapshot = await service.getRetrospective(PERIOD, []);
    expect(snapshot.buckets).toEqual([]);
    expect(snapshot.computedWidgets).toEqual([]);
    expect(repo.calls.revenueBuckets).toBe(0);
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
