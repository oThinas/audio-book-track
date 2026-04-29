"use client";

import { useMemo } from "react";

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

import { ChapterRow, type ChapterRowEntity, type ChapterRowOption } from "./chapter-row";

interface ChaptersTableProps {
  readonly chapters: ReadonlyArray<ChapterRowEntity>;
  readonly narrators: ReadonlyArray<ChapterRowOption>;
  readonly editors: ReadonlyArray<ChapterRowOption>;
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
            <TableHead className="w-40 text-right">Horas editadas</TableHead>
            {!isSelectionMode && <TableHead className="w-28 text-right">Ações</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {chapters.map((chapter) => (
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
              onSaved={onChapterSaved}
              onDeleted={onChapterDeleted}
              onToggleSelected={onToggleSelected}
            />
          ))}
          {chapters.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
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
