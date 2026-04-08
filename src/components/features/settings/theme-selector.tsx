"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { Theme } from "@/lib/domain/user-preference";
import { useAutoSavePreference } from "@/lib/hooks/use-auto-save-preference";

const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

interface ThemeSelectorProps {
  readonly initialValue: Theme;
}

export function ThemeSelector({ initialValue }: ThemeSelectorProps) {
  const { setTheme } = useTheme();
  const { save } = useAutoSavePreference();

  function handleChange(value: string) {
    const theme = value as Theme;
    setTheme(theme);
    save({ theme });
  }

  return (
    <RadioGroup
      defaultValue={initialValue}
      onValueChange={handleChange}
      className="flex w-fit gap-2"
    >
      {THEME_OPTIONS.map((option) => (
        <Label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-[13px] text-slate-500 transition-colors has-checked:border-blue-600 has-checked:bg-blue-600 has-checked:text-white"
        >
          <span className="sr-only">
            <RadioGroupItem value={option.value} />
          </span>
          <option.icon className="size-4" />
          {option.label}
        </Label>
      ))}
    </RadioGroup>
  );
}
