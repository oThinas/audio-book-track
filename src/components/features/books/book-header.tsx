"use client";

import { ArrowLeft, FileText, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { BookStatus } from "@/lib/domain/book";
import { formatCentsBRL } from "@/lib/utils";

import { StatusBadge } from "./status-badge";

export interface BookHeaderProps {
  readonly title: string;
  readonly studio: { readonly id: string; readonly name: string };
  readonly pricePerHourCents: number;
  readonly status: BookStatus;
  readonly totalChapters: number;
  readonly completedChapters: number;
  readonly totalEarningsCents: number;
}

export function BookHeader({
  title,
  studio,
  pricePerHourCents,
  status,
  totalChapters,
  completedChapters,
  totalEarningsCents,
}: BookHeaderProps) {
  return (
    <header className="mb-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link
          href="/books"
          data-testid="book-detail-back"
          className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar
        </Link>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground" data-testid="book-detail-studio">
            <span className="font-medium text-foreground">Estúdio:</span> {studio.name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled aria-disabled="true">
            <FileText aria-hidden="true" className="size-4" />
            Ver PDF
          </Button>
          <Button type="button" variant="outline" size="sm" disabled aria-disabled="true">
            <Pencil aria-hidden="true" className="size-4" />
            Editar livro
          </Button>
          <Button type="button" variant="outline" size="sm" disabled aria-disabled="true">
            <Trash2 aria-hidden="true" className="size-4" />
            Excluir capítulos
          </Button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-card p-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium uppercase text-muted-foreground">Status</dt>
          <dd>
            <StatusBadge status={status} />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium uppercase text-muted-foreground">R$/hora</dt>
          <dd className="text-base font-medium" data-testid="book-detail-price">
            {formatCentsBRL(pricePerHourCents)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium uppercase text-muted-foreground">Capítulos</dt>
          <dd className="text-base font-medium" data-testid="book-detail-chapters-summary">
            {completedChapters}/{totalChapters}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium uppercase text-muted-foreground">Ganho total</dt>
          <dd className="text-base font-medium" data-testid="book-detail-earnings">
            {formatCentsBRL(totalEarningsCents)}
          </dd>
        </div>
      </dl>
    </header>
  );
}
