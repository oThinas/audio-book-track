"use client";

import { usePreferenceInitializer } from "@/components/features/settings/hooks/use-preference-initializer";
import type { FontSize, PrimaryColor } from "@/lib/domain/user-preference";

interface PreferenceInitializerProps {
  readonly fontSize: FontSize;
  readonly primaryColor: PrimaryColor;
}

export function PreferenceInitializer({ fontSize, primaryColor }: PreferenceInitializerProps) {
  usePreferenceInitializer({ fontSize, primaryColor });
  return null;
}
