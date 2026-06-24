"use client";
"use no memo";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useMemo, useState, ViewTransition } from "react";

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
import type { RowState } from "@/hooks/row-animation";
import type { ChapterStatus } from "@/lib/domain/chapter";
import type { FocusWeekContext } from "@/lib/domain/chapter-deadline";
import { currentWeekRangeInAppTimezone, todayInAppTimezone } from "@/lib/domain/timezone";
import type { GroupingDimension } from "@/lib/url/grouping-param";

import { ChapterGroupRow } from "./chapter-group-row";
import { ChapterRow, type ChapterRowEntity, type ChapterRowOption } from "./chapter-row";
import { useChaptersReorder } from "./hooks/use-chapters-reorder";
import { useChaptersTable } from "./hooks/use-chapters-table";
import { useFocusWeekFilter } from "./hooks/use-focus-week-filter";

interface ChaptersTableProps {
  readonly bookId: string;
  readonly chaptersVersion: number;
  readonly chapters: ReadonlyArray<ChapterRowEntity>;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
  readonly grouping: ReadonlyArray<GroupingDimension>;
  readonly pricePerHourCents: number;
  readonly isSelectionMode: boolean;
  readonly selectedIds: ReadonlySet<string>;
  readonly rowState?: (id: string) => RowState;
  readonly onRowAnimationEnd?: (id: string) => void;
  readonly onChapterSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onChapterDeleted: (chapterId: string, bookDeleted: boolean) => void;
  readonly onToggleSelected: (chapterId: string, selected: boolean) => void;
  readonly onToggleSelectAll: (selected: boolean) => void;
  readonly onChaptersVersionChange?: (newVersion: number) => void;
  readonly onReorderConflict?: () => void;
}

function buildNameById(options: ReadonlyArray<ChapterRowOption>): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const option of options) map.set(option.id, option.name);
  return map;
}

export function ChaptersTable({
  bookId,
  chaptersVersion,
  chapters,
  narrators,
  editors,
  grouping,
  pricePerHourCents,
  isSelectionMode,
  selectedIds,
  rowState,
  onRowAnimationEnd,
  onChapterSaved,
  onChapterDeleted,
  onToggleSelected,
  onToggleSelectAll,
  onChaptersVersionChange,
  onReorderConflict,
}: ChaptersTableProps) {
  const reorder = useChaptersReorder({
    bookId,
    chapters,
    chaptersVersion,
    onVersionChange: onChaptersVersionChange,
    onConflict: onReorderConflict,
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const canReorder = grouping.length === 0;
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const currentIds = reorder.orderedChapters.map((c) => c.id);
      const fromIndex = currentIds.indexOf(String(active.id));
      const toIndex = currentIds.indexOf(String(over.id));
      if (fromIndex < 0 || toIndex < 0) return;
      const next = [...currentIds];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      void reorder.apply(next);
    },
    [reorder],
  );
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

  const { applyFilter, enabled: focusEnabled } = useFocusWeekFilter();
  const sourceChapters = canReorder ? reorder.orderedChapters : chapters;
  const filteredChapters = useMemo(
    () => applyFilter(sourceChapters),
    [applyFilter, sourceChapters],
  );
  const { table } = useChaptersTable({
    chapters: filteredChapters,
    grouping,
    pricePerHourCents,
  });
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

  const columnCount = 8; // [Drag], Título, Status, Narrador, Editor, Prazo, Horas editadas, Ações/Selection

  const sortableIds = useMemo(
    () => reorder.orderedChapters.map((c) => c.id),
    [reorder.orderedChapters],
  );

  return (
    <ScrollArea
      data-testid="chapters-scroll-area"
      className="max-h-[60vh] w-full rounded-lg border"
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
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
                {!isSelectionMode && canReorder && <TableHead className="w-8" aria-hidden="true" />}
                <TableHead className="w-[56ch]">Título</TableHead>
                <TableHead className="w-40">Status</TableHead>
                <TableHead className="w-56">Narrador</TableHead>
                <TableHead className="w-56">Editor</TableHead>
                <TableHead className="w-44">Prazo</TableHead>
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
                const orderedIndex = reorder.orderedChapters.findIndex((c) => c.id === chapter.id);
                const chapterRow = (
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
                    isFirst={orderedIndex === 0}
                    isLast={orderedIndex === reorder.orderedChapters.length - 1}
                    canReorder={canReorder}
                    focusContext={focusContext}
                    rowState={rowState?.(chapter.id)}
                    onRowAnimationEnd={
                      onRowAnimationEnd ? () => onRowAnimationEnd(chapter.id) : undefined
                    }
                    onSaved={onChapterSaved}
                    onDeleted={onChapterDeleted}
                    onChaptersVersionChange={onChaptersVersionChange}
                    onToggleSelected={onToggleSelected}
                    onMoveBy={(id, delta) => void reorder.moveBy(id, delta)}
                  />
                );
                // Per-row ViewTransition only when reordering is active (US5, D6):
                // each row then morphs to its new position. Grouped views don't
                // reorder, so wrapping there would add a needless crossfade.
                return canReorder ? (
                  <ViewTransition key={chapter.id}>{chapterRow}</ViewTransition>
                ) : (
                  chapterRow
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
              {chapters.length > 0 && filteredChapters.length === 0 && focusEnabled && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-12 text-center text-sm text-muted-foreground"
                    data-testid="chapters-focus-empty-state"
                  >
                    Nenhum capítulo no foco desta semana.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SortableContext>
      </DndContext>
    </ScrollArea>
  );
}

export type { ChapterRowEntity as ChapterRowData } from "./chapter-row";
