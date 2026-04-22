"use client";

import {
  type ClipboardEvent,
  type FocusEvent,
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { cn, formatBRL } from "@/lib/utils";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, className, onBlur, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const cents = Math.round(value * 100);
  const minCents = Math.round(min * 100);
  const maxCents = Math.round(max * 100);

  const displayValue = useMemo(() => formatBRL(cents / 100), [cents]);

  // During typing we clamp only to max: clamping up to min would break the
  // cents-first UX (the user builds up digit by digit — with min=100 and
  // typing "5" the intermediate 5 cents must not jump to 100). Min is
  // enforced on blur instead: when the user leaves the field with a non-zero
  // value below min, we snap to min. Zero stays valid as an empty state.
  function commit(nextCents: number) {
    const clamped = Math.max(0, Math.min(nextCents, maxCents));
    const asReais = clamped / 100;
    if (asReais === value) return;
    onChange(asReais);
  }

  // React 19's synthetic onBeforeInput does not fire in jsdom (delegated
  // listener at the root never dispatches, verified via diagnostic spec). A
  // native addEventListener on the input is the only way to intercept the
  // `beforeinput` event reliably across jsdom (for tests) and real browsers
  // (including mobile IME / virtual keyboards).
  useEffect(() => {
    const input = innerRef.current;
    if (!input) return;
    function handleBeforeInput(event: Event) {
      const data = (event as InputEvent).data;
      event.preventDefault();
      if (data === null || data === "") return;
      if (!/^\d$/.test(data)) return;
      commit(cents * 10 + Number(data));
    }
    input.addEventListener("beforeinput", handleBeforeInput);
    return () => input.removeEventListener("beforeinput", handleBeforeInput);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      commit(Math.floor(cents / 10));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    let next = cents;
    for (const digit of digits) {
      next = next * 10 + Number(digit);
      if (next >= maxCents) {
        next = maxCents;
        break;
      }
    }
    commit(next);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    if (cents > 0 && cents < minCents) {
      commit(minCents);
    }
    onBlur?.(event);
  }

  function setRef(element: HTMLInputElement | null) {
    innerRef.current = element;
    if (typeof forwardedRef === "function") {
      forwardedRef(element);
    } else if (forwardedRef) {
      forwardedRef.current = element;
    }
  }

  return (
    <input
      ref={setRef}
      type="text"
      inputMode="numeric"
      data-slot="money-input"
      value={displayValue}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onBlur={handleBlur}
      onChange={() => {
        // Controlled via beforeinput/keyDown/paste. Noop avoids React warning.
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...rest}
    />
  );
});
