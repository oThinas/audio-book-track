"use client";

import { Target } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ChapterFocusWeekToggleProps {
  readonly enabled: boolean;
  readonly onToggle: () => void;
}

export function ChapterFocusWeekToggle({ enabled, onToggle }: ChapterFocusWeekToggleProps) {
  return (
    <Button
      type="button"
      variant={enabled ? "default" : "outline"}
      size="sm"
      aria-pressed={enabled}
      onClick={onToggle}
      className="gap-2"
    >
      <Target aria-hidden="true" className="size-4" />
      Foco da semana
    </Button>
  );
}
