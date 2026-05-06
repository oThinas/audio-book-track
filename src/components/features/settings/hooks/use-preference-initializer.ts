"use client";

import { useEffect } from "react";
import type { FontSize, PrimaryColor } from "@/lib/domain/user-preference";

export interface UsePreferenceInitializerArgs {
  readonly fontSize: FontSize;
  readonly primaryColor: PrimaryColor;
}

const FONT_SIZE_PX: Record<FontSize, string> = {
  small: "14px",
  medium: "16px",
  large: "18px",
};

export function usePreferenceInitializer({
  fontSize,
  primaryColor,
}: UsePreferenceInitializerArgs): void {
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZE_PX[fontSize];
    document.documentElement.setAttribute("data-primary-color", primaryColor);
    try {
      localStorage.setItem("primary-color", primaryColor);
    } catch {}
  }, [fontSize, primaryColor]);
}
