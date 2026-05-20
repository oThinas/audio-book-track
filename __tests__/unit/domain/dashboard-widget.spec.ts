import { describe, expect, it } from "vitest";

import {
  DASHBOARD_WIDGET_META,
  DASHBOARD_WIDGETS,
  DEFAULT_DASHBOARD_WIDGETS,
  dashboardWidgetSchema,
  dashboardWidgetsArraySchema,
} from "@/lib/domain/dashboard-widget";

describe("dashboardWidgetSchema", () => {
  it("validates every key in DASHBOARD_WIDGETS", () => {
    for (const key of DASHBOARD_WIDGETS) {
      expect(() => dashboardWidgetSchema.parse(key)).not.toThrow();
    }
  });

  it("rejects unknown keys", () => {
    expect(() => dashboardWidgetSchema.parse("unknown-widget")).toThrow();
  });
});

describe("dashboardWidgetsArraySchema", () => {
  it("deduplicates duplicate entries", () => {
    const parsed = dashboardWidgetsArraySchema.parse([
      "a-receber-agora",
      "a-receber-agora",
      "receita-periodo",
    ]);
    expect(parsed).toEqual(["a-receber-agora", "receita-periodo"]);
  });

  it("accepts empty array", () => {
    expect(dashboardWidgetsArraySchema.parse([])).toEqual([]);
  });

  it("rejects array with invalid key", () => {
    expect(() => dashboardWidgetsArraySchema.parse(["a-receber-agora", "bogus"])).toThrow();
  });
});

describe("DEFAULT_DASHBOARD_WIDGETS", () => {
  it("contains exactly the 9 widget keys", () => {
    expect(DEFAULT_DASHBOARD_WIDGETS).toHaveLength(9);
    expect(new Set(DEFAULT_DASHBOARD_WIDGETS)).toEqual(new Set(DASHBOARD_WIDGETS));
  });
});

describe("DASHBOARD_WIDGET_META", () => {
  it("has an entry for every widget key with non-empty PT-BR title and description", () => {
    for (const key of DASHBOARD_WIDGETS) {
      const meta = DASHBOARD_WIDGET_META[key];
      expect(meta, `meta for ${key}`).toBeDefined();
      expect(meta.titlePtBr.length).toBeGreaterThan(0);
      expect(meta.descriptionPtBr.length).toBeGreaterThan(0);
      expect(["financial", "operational", "retrospective"]).toContain(meta.section);
    }
  });
});
