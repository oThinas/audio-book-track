export const GROUPING_DIMENSIONS = ["narrator", "editor", "status"] as const;
export type GroupingDimension = (typeof GROUPING_DIMENSIONS)[number];

export function isGroupingDimension(value: string): value is GroupingDimension {
  return (GROUPING_DIMENSIONS as readonly string[]).includes(value);
}

/**
 * Parseia o valor do search param `?groupBy=...` para uma hierarquia ordenada
 * de dimensões válidas. Tokens inválidos, duplicados ou desconhecidos invalidam
 * o input inteiro e retornamos `[]` (tabela flat). Função pura, sem throws.
 */
export function parseGroupingParam(raw: string | null): GroupingDimension[] {
  if (!raw) return [];
  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return [];

  const seen = new Set<string>();
  const result: GroupingDimension[] = [];
  for (const token of tokens) {
    if (seen.has(token)) return [];
    if (!isGroupingDimension(token)) return [];
    seen.add(token);
    result.push(token);
  }
  return result;
}

/**
 * Serializa a hierarquia para uso em search param. Retorna `null` quando a
 * hierarquia está vazia, sinalizando ao caller que o param deve ser removido
 * da URL (não setado como string vazia).
 */
export function serializeGroupingParam(grouping: ReadonlyArray<GroupingDimension>): string | null {
  if (grouping.length === 0) return null;
  return grouping.join(",");
}

export const UNASSIGNED_GROUP_KEY = "__unassigned__" as const;
export type UnassignedKey = typeof UNASSIGNED_GROUP_KEY;
