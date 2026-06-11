"use client";

import { type Control, Controller } from "react-hook-form";

import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { ChapterRowOption } from "./chapter-row";
import type { ChapterEditDraftValues } from "./hooks/use-chapter-row-edit";

interface ChapterAssigneeSelectCellProps {
  readonly control: Control<ChapterEditDraftValues>;
  readonly name: "narratorId" | "editorId";
  readonly options: ReadonlyArray<ChapterRowOption>;
  readonly nameById: ReadonlyMap<string, string>;
  readonly nullValue: string;
  readonly disabled: boolean;
  readonly defaultOpen: boolean;
  readonly testId: string;
  readonly placeholder: string;
}

/** Narrator/editor assignment cell: a nullable single-select bound to the edit form. */
export function ChapterAssigneeSelectCell({
  control,
  name,
  options,
  nameById,
  nullValue,
  disabled,
  defaultOpen,
  testId,
  placeholder,
}: ChapterAssigneeSelectCellProps) {
  return (
    <TableCell>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <Select
            value={field.value ?? nullValue}
            onValueChange={(value) => field.onChange(value === nullValue ? null : value)}
            disabled={disabled}
            defaultOpen={defaultOpen}
          >
            <SelectTrigger data-testid={testId} className="w-full">
              <span className={cn("truncate", field.value ? undefined : "text-muted-foreground")}>
                {field.value ? (nameById.get(field.value) ?? "—") : placeholder}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={nullValue}>—</SelectItem>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </TableCell>
  );
}
