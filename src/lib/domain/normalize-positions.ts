export function densifyPositions<T extends { readonly id: string }>(
  ordered: readonly T[],
): ReadonlyArray<{ readonly id: string; readonly position: number }> {
  return ordered.map((c, idx) => ({ id: c.id, position: idx }));
}
