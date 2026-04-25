"use client";

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
}

export function ChaptersTable({
  chapters,
  narrators,
  editors,
  onChapterSaved,
}: ChaptersTableProps) {
  return (
    <ScrollArea
      data-testid="chapters-scroll-area"
      className="max-h-[60vh] w-full rounded-lg border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Nº</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Narrador</TableHead>
            <TableHead>Editor</TableHead>
            <TableHead className="text-right">Horas editadas</TableHead>
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
              onSaved={onChapterSaved}
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
