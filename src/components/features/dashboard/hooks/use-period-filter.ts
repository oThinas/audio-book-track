"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  type DateRangeIso,
  type PeriodPreset,
  parsePeriodSearchParams,
} from "@/lib/domain/dashboard-period";

interface UsePeriodFilter {
  readonly period: DateRangeIso;
  readonly setPreset: (preset: PeriodPreset) => void;
  readonly setRange: (fromIso: string, toIso: string) => void;
}

export function usePeriodFilter(todayIso: string): UsePeriodFilter {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const period = useMemo(
    () => parsePeriodSearchParams(new URLSearchParams(searchParams.toString()), todayIso),
    [searchParams, todayIso],
  );

  const replace = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  const setPreset = useCallback(
    (preset: PeriodPreset) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("from");
      next.delete("to");
      next.set("preset", preset);
      replace(next);
    },
    [searchParams, replace],
  );

  const setRange = useCallback(
    (fromIso: string, toIso: string) => {
      if (fromIso > toIso) return;
      const next = new URLSearchParams(searchParams.toString());
      next.delete("preset");
      next.set("from", fromIso);
      next.set("to", toIso);
      replace(next);
    },
    [searchParams, replace],
  );

  return { period, setPreset, setRange };
}
