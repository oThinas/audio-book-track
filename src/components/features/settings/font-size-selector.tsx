"use client";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { FontSize } from "@/lib/domain/user-preference";
import { useAutoSavePreference } from "@/lib/hooks/use-auto-save-preference";
import { cn } from "@/lib/utils";

const FONT_SIZE_OPTIONS = [
  { value: "small", label: "Pequeno", px: "14px" },
  { value: "medium", label: "Médio", px: "16px" },
  { value: "large", label: "Grande", px: "18px" },
] as const;

interface FontSizeSelectorProps {
  readonly initialValue: FontSize;
}

export function FontSizeSelector({ initialValue }: FontSizeSelectorProps) {
  const { save } = useAutoSavePreference();

  function handleChange(value: string) {
    const fontSize = value as FontSize;
    const option = FONT_SIZE_OPTIONS.find((o) => o.value === fontSize);
    if (option) {
      document.documentElement.style.fontSize = option.px;
    }
    save({ fontSize });
  }

  return (
    <RadioGroup
      defaultValue={initialValue}
      onValueChange={handleChange}
      className="flex w-fit rounded-lg border border-border"
    >
      {FONT_SIZE_OPTIONS.map((option, i) => (
        <Label
          key={option.value}
          style={{ fontSize: option.px }}
          className={cn(
            "flex cursor-pointer items-center justify-center px-4 py-2.5 text-muted-foreground transition-colors has-checked:bg-primary has-checked:text-primary-foreground",
            i === 0 && "rounded-l-lg",
            i === FONT_SIZE_OPTIONS.length - 1 && "rounded-r-lg",
          )}
        >
          <span className="sr-only">
            <RadioGroupItem value={option.value} />
          </span>
          {option.label}
        </Label>
      ))}
    </RadioGroup>
  );
}
