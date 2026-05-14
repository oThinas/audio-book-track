"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import type { ChapterRowEntity } from "@/components/features/chapters/chapter-row";
import { type FocusWeekContext, isInFocusWeek } from "@/lib/domain/chapter-deadline";
import { currentWeekRangeInAppTimezone, todayInAppTimezone } from "@/lib/domain/timezone";
import { parseFocusParam, serializeFocusParam } from "@/lib/url/focus-param";

const FOCUS_PARAM = "focus";

export interface UseFocusWeekFilterReturn {
  readonly enabled: boolean;
  readonly toggle: () => void;
  readonly focusContext: FocusWeekContext;
  readonly applyFilter: (chapters: ReadonlyArray<ChapterRowEntity>) => ChapterRowEntity[];
}

export function useFocusWeekFilter(): UseFocusWeekFilterReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const focus = parseFocusParam(new URLSearchParams(searchParams.toString()));
  const enabled = focus === "week";

  const focusContext = useMemo<FocusWeekContext>(() => {
    const { mondayIso, sundayIso } = currentWeekRangeInAppTimezone();
    return { todayIso: todayInAppTimezone(), mondayIso, sundayIso };
  }, []);

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    const next: "week" | null = enabled ? null : "week";
    const serialized = serializeFocusParam(next);
    if (serialized === null) {
      params.delete(FOCUS_PARAM);
    } else {
      params.set(FOCUS_PARAM, serialized);
    }
    const queryString = params.toString();
    const target = queryString.length > 0 ? `${pathname}?${queryString}` : pathname;
    router.replace(target, { scroll: false });
  }, [enabled, pathname, router, searchParams]);

  const applyFilter = useCallback(
    (chapters: ReadonlyArray<ChapterRowEntity>) => {
      if (!enabled) return [...chapters];
      return chapters.filter((c) =>
        isInFocusWeek(
          {
            id: c.id,
            bookId: "",
            number: c.number,
            status: c.status,
            narratorId: c.narrator?.id ?? null,
            editorId: c.editor?.id ?? null,
            editedSeconds: c.editedSeconds,
            deadline: c.deadline,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          focusContext,
        ),
      );
    },
    [enabled, focusContext],
  );

  return { enabled, toggle, focusContext, applyFilter };
}
