export const GROUPING_DIMENSIONS = ["narrator", "editor", "status"] as const;
export type GroupingDimension = (typeof GROUPING_DIMENSIONS)[number];

export function isGroupingDimension(value: string): value is GroupingDimension {
  return (GROUPING_DIMENSIONS as readonly string[]).includes(value);
}

/**
 * Parses the `?groupBy=...` search param value into an ordered hierarchy of
 * valid dimensions. Invalid, duplicated or unknown tokens invalidate the entire
 * input and we return `[]` (flat table). Pure function, no throws.
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
 * Serializes the hierarchy for use in a search param. Returns `null` when the
 * hierarchy is empty, signaling to the caller that the param must be removed
 * from the URL (not set as an empty string).
 */
export function serializeGroupingParam(grouping: ReadonlyArray<GroupingDimension>): string | null {
  if (grouping.length === 0) return null;
  return grouping.join(",");
}

export const UNASSIGNED_GROUP_KEY = "__unassigned__" as const;
export type UnassignedKey = typeof UNASSIGNED_GROUP_KEY;
