"use client";

import { useMemo } from "react";

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
  readonly onChapterSaved: (updated: ChapterRowEntity, bookStatus: ChapterStatus) => void;
  readonly onChapterDeleted: (chapterId: string, bookDeleted: boolean) => void;
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
  onChapterSaved,
  onChapterDeleted,
}: ChaptersTableProps) {
  const narratorNameById = useMemo(() => buildNameById(narrators), [narrators]);
  const editorNameById = useMemo(() => buildNameById(editors), [editors]);
  const nonPaidCount = useMemo(
    () => chapters.filter((c) => c.status !== "paid").length,
    [chapters],
  );

  return (
    <ScrollArea
      data-testid="chapters-scroll-area"
      className="max-h-[60vh] w-full rounded-lg border"
    >
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Nº</TableHead>
            <TableHead className="w-40">Status</TableHead>
            <TableHead className="w-56">Narrador</TableHead>
            <TableHead className="w-56">Editor</TableHead>
            <TableHead className="w-40 text-right">Horas editadas</TableHead>
            <TableHead className="w-28 text-right">Ações</TableHead>
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
              onSaved={onChapterSaved}
              onDeleted={onChapterDeleted}
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
