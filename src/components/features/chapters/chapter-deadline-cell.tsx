"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChapterStatus } from "@/lib/domain/chapter";
import { type FocusWeekContext, isOverdue } from "@/lib/domain/chapter-deadline";
import { formatDeadline, formatRelativeDeadline } from "@/lib/utils/format-date";

interface ChapterDeadlineCellProps {
  readonly deadline: string | null;
  readonly status: ChapterStatus;
  readonly focusContext: FocusWeekContext;
}

export function ChapterDeadlineCell({ deadline, status, focusContext }: ChapterDeadlineCellProps) {
  if (deadline === null) {
    return <span className="text-muted-foreground">—</span>;
  }

  const overdue = isOverdue(
    {
      id: "",
      bookId: "",
      title: "",
      position: 0,
      status,
      narratorId: null,
      editorId: null,
      editedSeconds: 0,
      deadline,
      completedAt: null,
      paidAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    focusContext,
  );

  const tooltipText = overdue
    ? formatRelativeDeadline(deadline, focusContext)
    : formatRelativeDeadline(deadline, focusContext);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={
              overdue
                ? "inline-flex items-center gap-1 text-destructive"
                : "inline-flex items-center"
            }
          >
            {formatDeadline(deadline)}
          </span>
        }
      />
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
