import { describe, expect, it } from "vitest";

import type { ChapterStatus } from "@/lib/domain/chapter";
import {
  computeChapterEarningsCents,
  countByStatus,
  formatStatusBreakdown,
  sumChapterEarningsCents,
  sumEditedSeconds,
} from "@/lib/domain/chapter-aggregation";

function chapter(
  partial: Partial<{
    editedSeconds: number;
    status: ChapterStatus;
  }> = {},
) {
  return {
    editedSeconds: 0,
    status: "pending" as ChapterStatus,
    ...partial,
  };
}

describe("computeChapterEarningsCents", () => {
  it("retorna 0 quando editedSeconds = 0", () => {
    expect(computeChapterEarningsCents({ editedSeconds: 0 }, { pricePerHourCents: 5_000 })).toBe(0);
  });

  it("aplica fórmula round(editedSeconds * pricePerHourCents / 3600)", () => {
    // 1h exato a 50,00/h → 5000 centavos
    expect(computeChapterEarningsCents({ editedSeconds: 3600 }, { pricePerHourCents: 5_000 })).toBe(
      5_000,
    );
  });

  it("arredonda half-away-from-zero por capítulo (princípio II)", () => {
    // 30 min a 50,00/h → 2500 centavos exato
    expect(computeChapterEarningsCents({ editedSeconds: 1800 }, { pricePerHourCents: 5_000 })).toBe(
      2_500,
    );
    // 1 segundo a 7300/h → 7300/3600 = 2.027... → round = 2
    expect(computeChapterEarningsCents({ editedSeconds: 1 }, { pricePerHourCents: 7_300 })).toBe(2);
  });
});

describe("sumChapterEarningsCents", () => {
  it("arredonda POR CAPÍTULO antes de somar", () => {
    // Dois capítulos de 1s a 7300/h → cada um 2 cents (round individual) → soma = 4
    const chapters = [chapter({ editedSeconds: 1 }), chapter({ editedSeconds: 1 })];
    const result = sumChapterEarningsCents(chapters, { pricePerHourCents: 7_300 });
    expect(result).toBe(4);
    // Não pode ser round(2 * 1 * 7300 / 3600) = round(4.055) = 4 por coincidência aqui;
    // forçar caso onde half-away difere:
    // 3 caps de 1s a 7300/h: indiv = round(2.027) = 2 → soma 6;
    // vs round(3 * 7300 / 3600) = round(6.083) = 6 — coincide. Vamos provar com 5400/h:
    // 1s a 5400/h: 1.5 → round half-away = 2; 2 caps → soma 4;
    // round(2 * 5400 / 3600) = round(3) = 3 — diferenças aparecem
    const chapters2 = [chapter({ editedSeconds: 1 }), chapter({ editedSeconds: 1 })];
    const result2 = sumChapterEarningsCents(chapters2, { pricePerHourCents: 5_400 });
    expect(result2).toBe(4); // 2 + 2, não 3
  });

  it("retorna 0 para lista vazia", () => {
    expect(sumChapterEarningsCents([], { pricePerHourCents: 5_000 })).toBe(0);
  });

  it("retorna 0 quando todos os capítulos têm editedSeconds = 0", () => {
    const chapters = [chapter({ editedSeconds: 0 }), chapter({ editedSeconds: 0 })];
    expect(sumChapterEarningsCents(chapters, { pricePerHourCents: 5_000 })).toBe(0);
  });
});

describe("sumEditedSeconds", () => {
  it("soma editedSeconds com inteiros não-negativos", () => {
    const chapters = [
      chapter({ editedSeconds: 100 }),
      chapter({ editedSeconds: 200 }),
      chapter({ editedSeconds: 300 }),
    ];
    expect(sumEditedSeconds(chapters)).toBe(600);
  });

  it("retorna 0 para lista vazia", () => {
    expect(sumEditedSeconds([])).toBe(0);
  });

  it("ignora capítulos pendentes (0 segundos)", () => {
    const chapters = [chapter({ editedSeconds: 0 }), chapter({ editedSeconds: 60 })];
    expect(sumEditedSeconds(chapters)).toBe(60);
  });
});

describe("countByStatus", () => {
  it("retorna record completo com todos os status zerados quando lista vazia", () => {
    expect(countByStatus([])).toEqual({
      pending: 0,
      editing: 0,
      reviewing: 0,
      retake: 0,
      completed: 0,
      paid: 0,
    });
  });

  it("conta corretamente cada status", () => {
    const chapters = [
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "paid" }),
    ];
    expect(countByStatus(chapters)).toEqual({
      pending: 0,
      editing: 0,
      reviewing: 1,
      retake: 0,
      completed: 2,
      paid: 1,
    });
  });

  it("soma das contagens igual ao tamanho da lista", () => {
    const chapters = [
      chapter({ status: "pending" }),
      chapter({ status: "editing" }),
      chapter({ status: "completed" }),
    ];
    const counts = countByStatus(chapters);
    const total = Object.values(counts).reduce((acc, n) => acc + n, 0);
    expect(total).toBe(chapters.length);
  });
});

describe("formatStatusBreakdown", () => {
  it("retorna apenas contagem quando a dimensão do nível é status", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
    ]);
    expect(formatStatusBreakdown(breakdown, "status")).toBe("3 capítulos");
  });

  it("usa singular quando há apenas 1 capítulo (dimensão status)", () => {
    const breakdown = countByStatus([chapter({ status: "paid" })]);
    expect(formatStatusBreakdown(breakdown, "status")).toBe("1 capítulo");
  });

  it("lista status com contagem > 0 separados por ' · ' em ordem do enum", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
    ]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("1 em revisão · 3 concluídos");
  });

  it("omite status com contagem 0", () => {
    const breakdown = countByStatus([chapter({ status: "pending" }), chapter({ status: "paid" })]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("1 pendente · 1 pago");
  });

  it("retorna string vazia quando todos zerados (lista vazia)", () => {
    const breakdown = countByStatus([]);
    expect(formatStatusBreakdown(breakdown, null)).toBe("");
  });

  it("usa singular/plural correto para cada status", () => {
    const breakdown = countByStatus([
      chapter({ status: "pending" }),
      chapter({ status: "pending" }),
      chapter({ status: "editing" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "reviewing" }),
      chapter({ status: "retake" }),
      chapter({ status: "completed" }),
      chapter({ status: "paid" }),
      chapter({ status: "paid" }),
      chapter({ status: "paid" }),
    ]);
    expect(formatStatusBreakdown(breakdown, null)).toBe(
      "2 pendentes · 1 em edição · 2 em revisão · 1 retake · 1 concluído · 3 pagos",
    );
  });

  it("para dimensão narrator/editor, comporta-se igual a null (full breakdown)", () => {
    const breakdown = countByStatus([
      chapter({ status: "completed" }),
      chapter({ status: "reviewing" }),
    ]);
    const result = formatStatusBreakdown(breakdown, "narrator");
    expect(result).toBe("1 em revisão · 1 concluído");
    expect(result).toBe(formatStatusBreakdown(breakdown, "editor"));
    expect(result).toBe(formatStatusBreakdown(breakdown, null));
  });
});
