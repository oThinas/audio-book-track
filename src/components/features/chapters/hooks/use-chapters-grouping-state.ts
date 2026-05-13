"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  type GroupingDimension,
  parseGroupingParam,
  serializeGroupingParam,
} from "@/lib/url/grouping-param";

const GROUP_BY_PARAM = "groupBy";

export interface UseChaptersGroupingStateReturn {
  readonly grouping: ReadonlyArray<GroupingDimension>;
  readonly setGrouping: (next: ReadonlyArray<GroupingDimension>) => void;
}

/**
 * Synchronizes the chapter table grouping state with the current route's
 * `?groupBy=...` search param.
 *
 * - Read: parses the param via `parseGroupingParam` — invalid input becomes
 *   `[]` (flat table) silently (FR-003).
 * - Write: `router.replace` without scroll, preserving other search params.
 *   Empty list removes the param instead of setting it as an empty string.
 */
export function useChaptersGroupingState(): UseChaptersGroupingStateReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawGroupBy = searchParams.get(GROUP_BY_PARAM);
  const grouping = useMemo(() => parseGroupingParam(rawGroupBy), [rawGroupBy]);

  const setGrouping = useCallback(
    (next: ReadonlyArray<GroupingDimension>) => {
      const params = new URLSearchParams(searchParams.toString());
      const serialized = serializeGroupingParam(next);
      if (serialized === null) {
        params.delete(GROUP_BY_PARAM);
      } else {
        params.set(GROUP_BY_PARAM, serialized);
      }
      const queryString = params.toString();
      const target = queryString.length > 0 ? `${pathname}?${queryString}` : pathname;
      router.replace(target, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return { grouping, setGrouping };
}
