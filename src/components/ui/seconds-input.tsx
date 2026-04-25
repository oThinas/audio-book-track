"use client";

import {
  type ClipboardEvent,
  forwardRef,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  cn,
  digitsFromSeconds,
  displayFromDigits,
  secondsFromDigits,
  TIMECODE_BUFFER_SIZE,
} from "@/lib/utils";

export interface SecondsInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  readonly value: number;
  readonly onChange: (seconds: number) => void;
  readonly max?: number;
}

/**
 * HH:MM:SS timecode-style duration input. Each typed digit shifts existing
 * digits left and lands on the rightmost slot, mirroring how a digital clock
 * is set: typing "12545" yields 01:25:45 (not 12545 seconds).
 *
 * Internally maintains a 6-digit buffer ("HHMMSS"). The buffer is the source
 * of truth during interaction so the display does not snap to canonical form
 * mid-typing. The component emits canonical seconds via onChange.
 */
export const SecondsInput = forwardRef<HTMLInputElement, SecondsInputProps>(function SecondsInput(
  { value: seconds, onChange, max: maxSeconds = Number.MAX_SAFE_INTEGER, className, ...rest },
  forwardedRef,
) {
  const innerRef = useRef<HTMLInputElement | null>(null);
  const [buffer, setBuffer] = useState<string>(() => digitsFromSeconds(seconds));
  const lastEmittedRef = useRef<number>(seconds);

  // Resync the buffer when the parent passes a value we did not emit. Keeps
  // the input controlled (initial mount, external resets) without snapping
  // the user's in-progress digits to canonical HH:MM:SS form.
  useEffect(() => {
    if (seconds !== lastEmittedRef.current && seconds !== secondsFromDigits(buffer)) {
      setBuffer(digitsFromSeconds(seconds));
      lastEmittedRef.current = seconds;
    }
  }, [seconds, buffer]);

  function commit(nextBuffer: string) {
    const next = nextBuffer.padStart(TIMECODE_BUFFER_SIZE, "0").slice(-TIMECODE_BUFFER_SIZE);
    let nextSeconds = secondsFromDigits(next);
    let canonical = next;
    if (nextSeconds > maxSeconds) {
      nextSeconds = maxSeconds;
      canonical = digitsFromSeconds(maxSeconds);
    }
    setBuffer(canonical);
    if (nextSeconds !== seconds) {
      lastEmittedRef.current = nextSeconds;
      onChange(nextSeconds);
    }
  }

  // React 19's synthetic onBeforeInput does not fire in jsdom — a native
  // addEventListener on the input is the only reliable interception path
  // across jsdom (tests) and real browsers (incl. mobile IME).
  useEffect(() => {
    const input = innerRef.current;
    if (!input) return;
    function handleBeforeInput(event: Event) {
      const data = (event as InputEvent).data;
      event.preventDefault();
      if (data === null || data === "") return;
      if (!/^\d$/.test(data)) return;
      commit(buffer + data);
    }
    input.addEventListener("beforeinput", handleBeforeInput);
    return () => input.removeEventListener("beforeinput", handleBeforeInput);
  });

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      commit(`0${buffer.slice(0, -1)}`);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    commit(buffer + digits);
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
      value={displayFromDigits(buffer)}
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
