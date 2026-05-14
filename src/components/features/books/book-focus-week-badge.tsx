import { Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";

interface BookFocusWeekBadgeProps {
  readonly count: number;
}

export function BookFocusWeekBadge({ count }: BookFocusWeekBadgeProps) {
  if (count <= 0) return null;
  return (
    <Badge variant="secondary" className="gap-1.5">
      <Target aria-hidden="true" className="size-3" />
      Foco da semana · {count}
    </Badge>
  );
}
