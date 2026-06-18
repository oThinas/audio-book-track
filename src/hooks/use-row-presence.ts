"use client";
// Opt out of React Compiler: this hook seeds a ref lazily during render
// (prevIdsRef) and memoizes everything explicitly with useMemo/useCallback, so
// it does not need — and should not be reshaped by — automatic memoization.
"use no memo";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RowState } from "@/hooks/row-animation";

interface RowPresenceOptions<T> {
  /** Live items — the already-optimistic source of truth. */
  readonly items: readonly T[];
  /** Extracts the stable id of an item (the same value used as the React key). */
  readonly getId: (item: T) => string;
}

interface RowPresence<T> {
  /** Items to render = live items plus rows still animating their exit, with position preserved. */
  readonly renderItems: readonly T[];
  /** Animation state of a row by id. */
  readonly rowState: (id: string) => RowState;
  /**
   * Removes a row with an exit animation. `commit` runs immediately and should
   * perform the optimistic removal from the source list (e.g. fire the DELETE
   * and drop the item from state). The row is retained in `renderItems` until
   * `onRowAnimationEnd` fires. Under reduced motion the row is not retained —
   * `commit` runs and the row disappears as soon as the source drops it.
   */
  readonly remove: (id: string, commit: () => void) => void;
  /** Bind to a row's `onAnimationEnd`; clears the entering/exiting state for that id. */
  readonly onRowAnimationEnd: (id: string) => void;
}

interface ExitingRow<T> {
  readonly id: string;
  readonly item: T;
  /** Id of the row that preceded this one when it left, or null if it was first. */
  readonly afterId: string | null;
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Adds animated presence (enter/exit) to a list held in state. It does not
 * fetch or own domain data — it only derives which rows are `entering`/`exiting`
 * and what the table should render. Reused by chapters, narrators, editors and
 * studios (feature 037; contract in specs/037-list-row-animations/contracts).
 */
export function useRowPresence<T>({ items, getId }: RowPresenceOptions<T>): RowPresence<T> {
  // Ids seen on the previous render. Seeded lazily on first render so rows
  // present at mount never animate entrance (FR-005). Updated in an effect.
  const prevIdsRef = useRef<Set<string> | null>(null);
  if (prevIdsRef.current === null) {
    prevIdsRef.current = new Set(items.map(getId));
  }

  const [enteringIds, setEnteringIds] = useState<ReadonlySet<string>>(() => new Set());
  const [exitingRows, setExitingRows] = useState<readonly ExitingRow<T>[]>([]);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Detect the user's motion preference after mount (avoids a hydration mismatch;
  // additions/removals are post-hydration interactions, so this is settled in time).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    setPrefersReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Mark rows that appeared after the previous render as entering.
  useEffect(() => {
    const liveIds = items.map(getId);
    const previous = prevIdsRef.current ?? new Set<string>();
    prevIdsRef.current = new Set(liveIds);

    if (prefersReducedMotion) return;

    const added = liveIds.filter((id) => !previous.has(id));
    if (added.length === 0) return;

    setEnteringIds((prev) => {
      const next = new Set(prev);
      for (const id of added) next.add(id);
      return next;
    });
  }, [items, getId, prefersReducedMotion]);

  const exitingIds = useMemo(() => new Set(exitingRows.map((row) => row.id)), [exitingRows]);

  const renderItems = useMemo<readonly T[]>(() => {
    if (exitingRows.length === 0) return items;

    const liveIdSet = new Set(items.map(getId));
    // Skip exiting rows still present in the live list (commit not applied yet) to avoid duplicates.
    const pending = exitingRows.filter((row) => !liveIdSet.has(row.id));
    if (pending.length === 0) return items;

    const result = [...items];
    let remaining = pending;
    // Insert each retained row after its former predecessor; iterate so chains
    // of adjacent removals (bulk-delete) resolve once their predecessor lands.
    let madeProgress = true;
    while (remaining.length > 0 && madeProgress) {
      madeProgress = false;
      const stillPending: ExitingRow<T>[] = [];
      for (const row of remaining) {
        if (row.afterId === null) {
          result.unshift(row.item);
          madeProgress = true;
          continue;
        }
        const position = result.findIndex((item) => getId(item) === row.afterId);
        if (position === -1) {
          stillPending.push(row);
          continue;
        }
        result.splice(position + 1, 0, row.item);
        madeProgress = true;
      }
      remaining = stillPending;
    }
    // Predecessor gone entirely (unexpected): append so the row is never lost.
    for (const row of remaining) result.push(row.item);

    return result;
  }, [items, exitingRows, getId]);

  const rowState = useCallback(
    (id: string): RowState => {
      if (exitingIds.has(id)) return "exiting";
      if (enteringIds.has(id)) return "entering";
      return "idle";
    },
    [exitingIds, enteringIds],
  );

  const remove = useCallback(
    (id: string, commit: () => void): void => {
      if (prefersReducedMotion) {
        commit();
        return;
      }

      const index = renderItems.findIndex((item) => getId(item) === id);
      if (index === -1) {
        commit();
        return;
      }

      const item = renderItems[index];
      const afterId = index > 0 ? getId(renderItems[index - 1]) : null;
      setExitingRows((prev) =>
        prev.some((row) => row.id === id) ? prev : [...prev, { id, item, afterId }],
      );
      commit();
    },
    [prefersReducedMotion, renderItems, getId],
  );

  const onRowAnimationEnd = useCallback((id: string): void => {
    setEnteringIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setExitingRows((prev) =>
      prev.some((row) => row.id === id) ? prev.filter((row) => row.id !== id) : prev,
    );
  }, []);

  return { renderItems, rowState, remove, onRowAnimationEnd };
}
