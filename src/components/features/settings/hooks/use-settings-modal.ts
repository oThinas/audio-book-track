"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export interface UseSettingsModalReturn {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Drives the intercepted settings modal: starts open and, on close (button,
 * Esc, overlay click), navigates back to the underlying page so the URL is
 * restored (contract C3, FR-010).
 */
export function useSettingsModal(): UseSettingsModalReturn {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  const onOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        router.back();
      }
    },
    [router],
  );

  return { open, onOpenChange };
}
