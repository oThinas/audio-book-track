"use client";

import { useState } from "react";

export interface UsePaidReversionReturn<TPending> {
  readonly pending: TPending | null;
  readonly request: (values: TPending) => void;
  readonly cancel: () => void;
  readonly take: () => TPending | null;
}

/**
 * State carrier for the "paid → completed" reversion flow. Holds the pending
 * draft values so the user can confirm the destructive transition in a dialog
 * before persisting.
 */
export function usePaidReversion<TPending>(): UsePaidReversionReturn<TPending> {
  const [pending, setPending] = useState<TPending | null>(null);

  function take(): TPending | null {
    const current = pending;
    setPending(null);
    return current;
  }

  return {
    pending,
    request: setPending,
    cancel: () => setPending(null),
    take,
  };
}
