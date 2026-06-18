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
  /** Opens the dropdown on mount — used by double-click-to-edit activation. */
  readonly defaultOpen?: boolean;
}

const ALL_STATUSES: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
] as const;

const ALL_EXCEPT_PAID: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
] as const;

/**
 * Mirrors only the TOPOLOGY of the state machine (which options are selectable),
 * not field presence — narrator/editor/editedSeconds are enforced on Save
 * (FR-014). `paid` is the only guarded status: offered only from `completed`;
 * from `paid` only `paid` (current) and `completed` are reachable. Free movement
 * between the other non-paid statuses. See Constitution Principle III.
 */
function reachableTargets(current: ChapterStatus): ReadonlyArray<ChapterStatus> {
  if (current === "paid") {
    return ["paid", "completed"];
  }
  if (current === "completed") {
    return [...ALL_EXCEPT_PAID, "paid"];
  }
  return ALL_EXCEPT_PAID;
}

export function ChapterStatusSelect({
  currentStatus,
  value,
  onChange,
  id,
  disabled,
  defaultOpen,
}: ChapterStatusSelectProps) {
  const targets = useMemo(() => reachableTargets(currentStatus), [currentStatus]);

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ChapterStatus)}
      disabled={disabled}
      defaultOpen={defaultOpen}
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
