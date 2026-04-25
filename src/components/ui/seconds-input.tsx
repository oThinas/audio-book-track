"use client";

import {
  type ClipboardEvent,
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
} from "react";

import { cn, formatSecondsAsHHMMSS } from "@/lib/utils";

export interface SecondsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  readonly value: number;
  readonly onChange: (seconds: number) => void;
  readonly max?: number;
}

/**
 * Seconds-first duration input. Callers pass and receive integer seconds —
 * the canonical representation of duration in this codebase. The component
 * formats `HH:MM:SS` on screen and accumulates digits seconds-first (typing
 * "12345" yields 03:25:45).
 */
export const SecondsInput = forwardRef<HTMLInputElement, SecondsInputProps>(function SecondsInput(
  { value: seconds, onChange, max: maxSeconds = Number.MAX_SAFE_INTEGER, className, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);

  const displayValue = useMemo(() => formatSecondsAsHHMMSS(seconds), [seconds]);

  function commit(nextSeconds: number) {
    const clamped = Math.max(0, Math.min(nextSeconds, maxSeconds));
    if (clamped === seconds) return;
    onChange(clamped);
  }

  // Mirrors MoneyInput: React 19's synthetic onBeforeInput does not fire in
  // jsdom — a native addEventListener on the input is the only reliable
  // interception path across jsdom (tests) and real browsers.
  useEffect(() => {
    const input = innerRef.current;
    if (!input) return;
    function handleBeforeInput(event: Event) {
      const data = (event as InputEvent).data;
      event.preventDefault();
      if (data === null || data === "") return;
      if (!/^\d$/.test(data)) return;
      commit(seconds * 10 + Number(data));
    }
    input.addEventListener("beforeinput", handleBeforeInput);
    return () => input.removeEventListener("beforeinput", handleBeforeInput);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      commit(Math.floor(seconds / 10));
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    let next = seconds;
    for (const digit of digits) {
      next = next * 10 + Number(digit);
      if (next >= maxSeconds) {
        next = maxSeconds;
        break;
      }
    }
    commit(next);
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
      data-slot="seconds-input"
      value={displayValue}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={() => {
        // Controlled via beforeinput/keyDown/paste. Noop avoids React warning.
      }}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base tabular-nums transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...rest}
    />
  );
});
