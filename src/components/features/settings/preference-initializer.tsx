"use client";

import { useEffect } from "react";
import type { FontSize, PrimaryColor } from "@/lib/domain/user-preference";

interface PreferenceInitializerProps {
  readonly fontSize: FontSize;
  readonly primaryColor: PrimaryColor;
}

export function PreferenceInitializer({ fontSize, primaryColor }: PreferenceInitializerProps) {
  useEffect(() => {
    const fontSizeMap = { small: "14px", medium: "16px", large: "18px" } as const;
    document.documentElement.style.fontSize = fontSizeMap[fontSize];
    document.documentElement.setAttribute("data-primary-color", primaryColor);
  }, [fontSize, primaryColor]);

  return null;
}
