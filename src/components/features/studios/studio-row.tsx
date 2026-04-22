"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import type { Studio } from "@/lib/domain/studio";
import { formatBRL } from "@/lib/utils";

interface StudioRowProps {
  readonly studio: Studio;
  readonly onUpdated?: (studio: Studio) => void;
  readonly onRequestDelete?: (studio: Studio) => void;
}

export function StudioRow({ studio }: StudioRowProps) {
  return (
    <TableRow data-testid="studio-row">
      <TableCell data-testid="studio-name" className="text-foreground">
        {studio.name}
      </TableCell>
      <TableCell data-testid="studio-hourly-rate" className="text-foreground">
        {formatBRL(studio.defaultHourlyRate)}
      </TableCell>
      <TableCell className="text-right" />
    </TableRow>
  );
}
