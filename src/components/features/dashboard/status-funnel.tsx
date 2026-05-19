import { type ChapterStatus, chapterStatusLabel } from "@/lib/domain/chapter";

import type { StatusFunnel as StatusFunnelData } from "@/lib/repositories/dashboard-repository";

const STATUS_ORDER: ReadonlyArray<ChapterStatus> = [
  "pending",
  "editing",
  "reviewing",
  "retake",
  "completed",
  "paid",
];

interface StatusFunnelProps {
  readonly funnel: StatusFunnelData;
}

export function StatusFunnel({ funnel }: StatusFunnelProps) {
  return (
    <section aria-label="Funil de status" className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Funil de status
      </h2>
      <ul className="flex flex-wrap gap-2">
        {STATUS_ORDER.map((status) => (
          <li
            key={status}
            className="flex items-baseline gap-2 rounded-md border border-border/40 bg-card px-3 py-1.5 text-sm shadow-sm"
          >
            <span className="text-muted-foreground">{chapterStatusLabel(status)}</span>
            <span className="font-semibold text-foreground">{funnel[status]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
