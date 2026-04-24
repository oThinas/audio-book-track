"use client";

import { Pencil, Trash2 } from "lucide-react";

import { StatusBadge } from "@/components/features/books/status-badge";
import { Button } from "@/components/ui/button";
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
import { formatSecondsAsHours } from "@/lib/utils";

export interface ChapterRowData {
  readonly id: string;
  readonly number: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
}

interface ChaptersTableProps {
  readonly chapters: readonly ChapterRowData[];
}

export function ChaptersTable({ chapters }: ChaptersTableProps) {
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
            <TableRow key={chapter.id} data-testid={`chapter-row-${chapter.id}`}>
              <TableCell className="font-medium">{chapter.number}</TableCell>
              <TableCell>
                <StatusBadge status={chapter.status} />
              </TableCell>
              <TableCell className="text-muted-foreground">
                {chapter.narrator ? chapter.narrator.name : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {chapter.editor ? chapter.editor.name : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatSecondsAsHours(chapter.editedSeconds)}
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar capítulo ${chapter.number}`}
                    data-testid={`chapter-edit-${chapter.id}`}
                    disabled
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Excluir capítulo ${chapter.number}`}
                    data-testid={`chapter-delete-${chapter.id}`}
                    disabled
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
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
