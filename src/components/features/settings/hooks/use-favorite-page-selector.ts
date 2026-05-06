"use client";

import { useState } from "react";
import type { FavoritePage, UpdateUserPreference } from "@/lib/domain/user-preference";

export interface UseFavoritePageSelectorArgs {
  readonly initialValue: FavoritePage;
  readonly save: (data: UpdateUserPreference) => void;
}

export interface UseFavoritePageSelectorReturn {
  readonly value: FavoritePage;
  readonly handleChange: (newValue: FavoritePage | null) => void;
}

export function useFavoritePageSelector({
  initialValue,
  save,
}: UseFavoritePageSelectorArgs): UseFavoritePageSelectorReturn {
  const [value, setValue] = useState<FavoritePage>(initialValue);

  function handleChange(newValue: FavoritePage | null) {
    if (!newValue) return;
    setValue(newValue);
    save({ favoritePage: newValue });
  }

  return { value, handleChange };
}
