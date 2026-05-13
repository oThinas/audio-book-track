import type { GroupingDimension } from "@/lib/url/grouping-param";
import type { ChapterStatus } from "./chapter";
import { computeEarningsCents } from "./earnings";

const STATUS_ORDER: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
];

/**
 * Singular / plural por status. Usado em breakdown ("3 concluídos · 1 em revisão").
 */
const STATUS_LABEL: Record<ChapterStatus, { readonly singular: string; readonly plural: string }> =
  {
    pending: { singular: "pendente", plural: "pendentes" },
    editing: { singular: "em edição", plural: "em edição" },
    reviewing: { singular: "em revisão", plural: "em revisão" },
    retake: { singular: "retake", plural: "retake" },
    completed: { singular: "concluído", plural: "concluídos" },
    paid: { singular: "pago", plural: "pagos" },
  };

export type StatusBreakdown = Readonly<Record<ChapterStatus, number>>;

interface ChapterLike {
  readonly editedSeconds: number;
  readonly status: ChapterStatus;
}

interface BookPriceLike {
  readonly pricePerHourCents: number;
}

/**
 * Calcula o ganho em centavos de UM capítulo seguindo a fórmula auditável do
 * domínio (Princípio II). Conversão para reais é responsabilidade da
 * apresentação.
 */
export function computeChapterEarningsCents(
  chapter: { readonly editedSeconds: number },
  book: BookPriceLike,
): number {
  return computeEarningsCents(chapter.editedSeconds, book.pricePerHourCents);
}

/**
 * Soma o ganho de uma coleção de capítulos.
 *
 * **Importante**: arredonda POR capítulo antes de somar — Princípio II garante
 * que somar segundos e depois aplicar a fórmula daria um total diferente do
 * total auditável visto pelo usuário em cada linha individual.
 */
export function sumChapterEarningsCents(
  chapters: ReadonlyArray<{ readonly editedSeconds: number }>,
  book: BookPriceLike,
): number {
  return chapters.reduce((total, chapter) => total + computeChapterEarningsCents(chapter, book), 0);
}

/**
 * Soma a duração editada de uma coleção de capítulos. Capítulos com
 * `editedSeconds = 0` contribuem 0 mas continuam contando como integrantes do
 * grupo (responsabilidade do caller).
 */
export function sumEditedSeconds(chapters: ReadonlyArray<ChapterLike>): number {
  return chapters.reduce((total, chapter) => total + chapter.editedSeconds, 0);
}

/**
 * Conta capítulos por status. Sempre retorna o record completo com todos os
 * status presentes (zerados quando ausentes) para facilitar consumo.
 */
export function countByStatus(chapters: ReadonlyArray<ChapterLike>): StatusBreakdown {
  const counts: Record<ChapterStatus, number> = {
    pending: 0,
    editing: 0,
    reviewing: 0,
    retake: 0,
    completed: 0,
    paid: 0,
  };
  for (const chapter of chapters) {
    counts[chapter.status] += 1;
  }
  return counts;
}

/**
 * Formata o breakdown para exibição na linha-resumo do grupo.
 *
 * - Quando `dimensionAtLevel === "status"`, a linha-resumo já representa um
 *   status específico → mostrar apenas a contagem total (evita redundância,
 *   FR-015).
 * - Caso contrário, lista status com contagem > 0 em ordem do enum, separados
 *   por ` · ` (ex: "1 em revisão · 3 concluídos"). Singular/plural por status.
 * - Lista vazia → string vazia.
 */
export function formatStatusBreakdown(
  breakdown: StatusBreakdown,
  dimensionAtLevel: GroupingDimension | null,
): string {
  if (dimensionAtLevel === "status") {
    const total = STATUS_ORDER.reduce((acc, status) => acc + breakdown[status], 0);
    return `${total} ${total === 1 ? "capítulo" : "capítulos"}`;
  }

  const parts: string[] = [];
  for (const status of STATUS_ORDER) {
    const count = breakdown[status];
    if (count === 0) continue;
    const labels = STATUS_LABEL[status];
    parts.push(`${count} ${count === 1 ? labels.singular : labels.plural}`);
  }
  return parts.join(" · ");
}
