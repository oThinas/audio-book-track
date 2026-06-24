import { NAV_ITEMS } from "@/lib/constants/navigation";

/**
 * View-transition direction derived purely from a (from, to) route pair.
 * Never consults browser history (FR-017). See contract C1.
 */
export type NavTransitionType = "nav-up" | "nav-down" | "depth-forward" | "depth-back" | "none";

function segmentsOf(path: string): readonly string[] {
  return path.split("/").filter(Boolean);
}

/** True when `prefix` is a strict, segment-wise prefix of `full`. */
function isStrictSegmentPrefix(prefix: readonly string[], full: readonly string[]): boolean {
  if (prefix.length >= full.length) {
    return false;
  }
  return prefix.every((segment, index) => segment === full[index]);
}

/** Index of an exact top-level nav item, or -1 when the path is not one. */
function topLevelIndex(path: string): number {
  return NAV_ITEMS.findIndex((item) => item.href === path);
}

/**
 * Resolves the directional view-transition type for navigating from `fromPath`
 * to `toPath`. Evaluation order (contract C1):
 *   1. toPath descendant of fromPath -> depth-forward
 *   2. toPath ancestor of fromPath   -> depth-back
 *   3. both top-level siblings, index(to) > index(from) -> nav-down
 *   4. both top-level siblings, index(to) < index(from) -> nav-up
 *   5. same route or anything else -> none
 */
export function resolveNavTransition(fromPath: string, toPath: string): NavTransitionType {
  if (fromPath === toPath) {
    return "none";
  }

  const fromSegments = segmentsOf(fromPath);
  const toSegments = segmentsOf(toPath);

  if (isStrictSegmentPrefix(fromSegments, toSegments)) {
    return "depth-forward";
  }
  if (isStrictSegmentPrefix(toSegments, fromSegments)) {
    return "depth-back";
  }

  const fromIndex = topLevelIndex(fromPath);
  const toIndex = topLevelIndex(toPath);
  if (fromIndex !== -1 && toIndex !== -1) {
    return toIndex > fromIndex ? "nav-down" : "nav-up";
  }

  return "none";
}
