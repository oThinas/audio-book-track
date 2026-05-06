"use client";

import { useState } from "react";
import type { PrimaryColor, UpdateUserPreference } from "@/lib/domain/user-preference";

export interface UsePrimaryColorSelectorArgs {
  readonly initialValue: PrimaryColor;
  readonly save: (data: UpdateUserPreference) => void;
}

export interface UsePrimaryColorSelectorReturn {
  readonly selected: PrimaryColor;
  readonly handleSelect: (color: PrimaryColor) => void;
}

export function usePrimaryColorSelector({
  initialValue,
  save,
}: UsePrimaryColorSelectorArgs): UsePrimaryColorSelectorReturn {
  const [selected, setSelected] = useState<PrimaryColor>(initialValue);

  function handleSelect(color: PrimaryColor) {
    setSelected(color);
    document.documentElement.setAttribute("data-primary-color", color);
    try {
      localStorage.setItem("primary-color", color);
    } catch {}
    save({ primaryColor: color });
  }

  return { selected, handleSelect };
}
