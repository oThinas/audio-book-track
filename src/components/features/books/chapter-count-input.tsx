"use client";

import { Minus, Plus } from "lucide-react";
import { forwardRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const CHAPTER_COUNT_MIN = 1;
export const CHAPTER_COUNT_MAX = 999;

interface ChapterCountInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type" | "min" | "max"
  > {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
}

export const ChapterCountInput = forwardRef<HTMLInputElement, ChapterCountInputProps>(
  function ChapterCountInput(
    {
      value,
      onChange,
      min = CHAPTER_COUNT_MIN,
      max = CHAPTER_COUNT_MAX,
      className,
      disabled,
      ...rest
    },
    ref,
  ) {
    const clamp = (next: number) => Math.min(max, Math.max(min, next));

    function handleInput(event: React.ChangeEvent<HTMLInputElement>) {
      const digits = event.target.value.replace(/\D/g, "");
      if (digits === "") {
        onChange(0);
        return;
      }
      onChange(clamp(Number(digits)));
    }

    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Diminuir quantidade"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - 1))}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          value={value === 0 ? "" : String(value)}
          onChange={handleInput}
          disabled={disabled}
          className="w-20 text-center"
          {...rest}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Aumentar quantidade"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp((value || min - 1) + 1))}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
    );
  },
);
