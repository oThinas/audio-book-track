"use client";
"use no memo";

import { useCallback, useMemo, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";
import { currentWeekRangeInAppTimezone, todayInAppTimezone } from "@/lib/domain/timezone";
import type { GroupingDimension } from "@/lib/url/grouping-param";

import { ChapterGroupRow } from "./chapter-group-row";
import { ChapterRow, type ChapterRowEntity, type ChapterRowOption } from "./chapter-row";
import { useChaptersTable } from "./hooks/use-chapters-table";

interface ChaptersTableProps {
  readonly chapters: ReadonlyArray<ChapterRowEntity>;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
  readonly grouping: ReadonlyArray<GroupingDimension>;
  readonly pricePerHourCents: number;
  readonly isSelectionMode: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly onChapterSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onChapterDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onToggleSelected: (chapterId: string, selected: boolean) => void;
  readonly onToggleSelectAll: (selected: boolean) => void;
}

function buildNameById(options: ReadonlyArray<ChapterRowOption>): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const option of options) map.set(option.id, option.name);
  return map;
}

export function ChaptersTable({
  chapters,
  narrators,
  editors,
  grouping,
  pricePerHourCents,
  isSelectionMode,
  selectedIds,
  onChapterSaved,
  onChapterDeleted,
  onToggleSelected,
  onToggleSelectAll,
}: ChaptersTableProps) {
  const narratorNameById = useMemo(() => buildNameById(narrators), [narrators]);
  const editorNameById = useMemo(() => buildNameById(editors), [editors]);
  const nonPaidCount = useMemo(
    () => chapters.filter((c) => c.status !== "paid").length,
    [chapters],
  );
  const allNonPaidSelected =
    isSelectionMode &&
    nonPaidCount > 0 &&
    chapters.every((c) => c.status === "paid" || selectedIds.has(c.id));
  const someSelected =
    isSelectionMode && chapters.some((c) => c.status !== "paid" && selectedIds.has(c.id));

  const focusContext = useMemo<FocusWeekContext>(() => {
    const { mondayIso, sundayIso } = currentWeekRangeInAppTimezone();
    return { todayIso: todayInAppTimezone(), mondayIso, sundayIso };
  }, []);

  const { table } = useChaptersTable({ chapters, grouping, pricePerHourCents });
  const allRows = table.getRowModel().rows;
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(() => new Set());
  const toggleGroup = useCallback((rowId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  // Visibility filter: a row (group or leaf) appears only when every ancestor
  // group is expanded. Top-level groups have no parent and are always visible.
  const rows = useMemo(() => {
    return allRows.filter((row) => {
      let parent = row.getParentRow();
      while (parent) {
        if (!expandedGroups.has(parent.id)) return false;
        parent = parent.getParentRow();
      }
      return true;
    });
  }, [allRows, expandedGroups]);

  const columnCount = 8; // Nº, Status, Narrador, Editor, Prazo, Horas editadas, Ações/Selection

  return (
    <ScrollArea
      data-testid="chapters-scroll-area"
      className="max-h-[60vh] w-full rounded-lg border"
    >
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            {isSelectionMode && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allNonPaidSelected}
                  indeterminate={!allNonPaidSelected && someSelected}
                  disabled={nonPaidCount === 0}
                  onCheckedChange={(value) => onToggleSelectAll(value === true)}
                  aria-label="Selecionar todos os capítulos não pagos"
                  data-testid="chapter-select-all"
                />
              </TableHead>
            )}
            <TableHead className="w-16">Nº</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-56">Narrador</TableHead>
            <TableHead className="w-56">Editor</TableHead>
            <TableHead className="w-32">Prazo</TableHead>
            <TableHead className="w-40 text-right">Horas editadas</TableHead>
            {!isSelectionMode && <TableHead className="w-28 text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            if (row.getIsGrouped()) {
              const groupColId = row.groupingColumnId as GroupingDimension | undefined;
              if (!groupColId) return null;
              return (
                <ChapterGroupRow
                  key={row.id}
                  row={row}
                  groupingDimension={groupColId}
                  columnCount={columnCount}
                  selectionMode={isSelectionMode}
                  isExpanded={expandedGroups.has(row.id)}
                  onToggle={toggleGroup}
                />
              );
            }
            const chapter = row.original;
            return (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                narrators={narrators}
                editors={editors}
                narratorNameById={narratorNameById}
                editorNameById={editorNameById}
                isLastNonPaid={chapter.status !== "paid" && nonPaidCount === 1}
                isSelectionMode={isSelectionMode}
                isSelected={selectedIds.has(chapter.id)}
                focusContext={focusContext}
                onSaved={onChapterSaved}
                onDeleted={onChapterDeleted}
                onToggleSelected={onToggleSelected}
              />
            );
          })}
          {chapters.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-12 text-center text-sm text-muted-foreground"
                data-testid="chapters-empty-state"
              >
                Este livro ainda não possui capítulos.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}

export type { ChapterRowEntity as ChapterRowData } from "./chapter-row";
