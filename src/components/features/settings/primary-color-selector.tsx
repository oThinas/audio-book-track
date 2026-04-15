"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { PrimaryColor } from "@/lib/domain/user-preference";
import { PRIMARY_COLORS } from "@/lib/domain/user-preference";
import { useAutoSavePreference } from "@/lib/hooks/use-auto-save-preference";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<PrimaryColor, { bg: string; ring: string }> = {
  blue: { bg: "bg-blue-600", ring: "ring-blue-600/50" },
  orange: { bg: "bg-orange-600", ring: "ring-orange-600/50" },
  green: { bg: "bg-emerald-600", ring: "ring-emerald-600/50" },
  red: { bg: "bg-rose-600", ring: "ring-rose-600/50" },
  amber: { bg: "bg-amber-600", ring: "ring-amber-600/50" },
};

interface PrimaryColorSelectorProps {
  readonly initialValue: PrimaryColor;
}

export function PrimaryColorSelector({ initialValue }: PrimaryColorSelectorProps) {
  const [selected, setSelected] = useState(initialValue);
  const { save } = useAutoSavePreference();

  function handleSelect(color: PrimaryColor) {
    setSelected(color);
    document.documentElement.setAttribute("data-primary-color", color);
    try {
      localStorage.setItem("primary-color", color);
    } catch {}
    save({ primaryColor: color });
  }

  return (
    <div className="flex gap-2 ml-auto md:ml-0">
      {PRIMARY_COLORS.map((color) => (
        // Botão nativo em vez de <Button> do shadcn: o componente Button aplica
        // variantes de hover (ghost torna branco) e estilos de foco que conflitam
        // com o swatch circular colorido. Um <button> nativo permite controle total
        // sobre bg, ring e hover sem overrides.
        <button
          key={color}
          type="button"
          data-testid={`color-swatch-${color}`}
          onClick={() => handleSelect(color)}
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-transform hover:scale-110",
            COLOR_MAP[color].bg,
            selected === color && `ring-2 ring-offset-2 ${COLOR_MAP[color].ring}`,
          )}
          aria-label={color}
        >
          {selected === color && <Check className="size-4 text-white" />}
        </button>
      ))}
    </div>
  );
}
