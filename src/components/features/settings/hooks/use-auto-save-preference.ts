"use client";

import { useCallback, useRef } from "react";
import type { UpdateUserPreference } from "@/lib/domain/user-preference";

export function useAutoSavePreference() {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const save = useCallback((data: UpdateUserPreference) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      await fetch("/api/v1/user-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }, 300);
  }, []);

  return { save } as const;
}
