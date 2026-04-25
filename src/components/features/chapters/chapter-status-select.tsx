"use client";

import { useMemo } from "react";
import { STATUS_LABELS } from "@/components/features/books/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { ChapterStatus } from "@/lib/domain/chapter";

interface ChapterStatusSelectProps {
  readonly currentStatus: ChapterStatus;
  readonly value: ChapterStatus;
  readonly onChange: (next: ChapterStatus) => void;
  readonly id?: string;
  readonly disabled?: boolean;
}

const ALL_STATUSES: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
] as const;

function reachableTargets(current: ChapterStatus): ReadonlyArray<ChapterStatus> {
  switch (current) {
    case "pending":
      return ["pending", "editing"];
    case "editing":
      return ["editing", "reviewing"];
    case "reviewing":
      return ["reviewing", "retake", "completed"];
    case "retake":
      return ["retake", "reviewing"];
    case "completed":
      return ["completed", "paid"];
    case "paid":
      return ["paid", "completed"];
    default: {
      const exhaustive: never = current;
      throw new Error(`Unknown chapter status: ${String(exhaustive)}`);
    }
  }
}

export function ChapterStatusSelect({
  currentStatus,
  value,
  onChange,
  id,
  disabled,
}: ChapterStatusSelectProps) {
  const targets = useMemo(() => reachableTargets(currentStatus), [currentStatus]);

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ChapterStatus)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className="w-full" data-testid={id ?? "chapter-status-select"}>
        <span>{STATUS_LABELS[value]}</span>
      </SelectTrigger>
      <SelectContent>
        {ALL_STATUSES.map((status) => (
          <SelectItem key={status} value={status} disabled={!targets.includes(status)}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
