"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import type { Studio } from "@/lib/domain/studio";

interface StudioRowProps {
  readonly studio: Studio;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function StudioRow({ studio }: StudioRowProps) {
  return (
    <TableRow data-testid="studio-row">
      <TableCell data-testid="studio-name" className="text-foreground">
        {studio.name}
      </TableCell>
      <TableCell data-testid="studio-hourly-rate" className="text-foreground">
        {BRL_FORMATTER.format(studio.defaultHourlyRate)}
      </TableCell>
      <TableCell className="text-right" />
    </TableRow>
  );
}
