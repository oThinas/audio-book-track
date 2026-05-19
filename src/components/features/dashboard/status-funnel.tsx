"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
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

// Lifecycle reads as a ramp: pending = lightest (furthest from "done"),
// paid = full primary saturation (terminal state). Reverse order from STATUS_ORDER
// so completed/paid are the most-saturated chips.
const STATUS_COLOR: Record<ChapterStatus, string> = {
  pending: "var(--chart-6)",
  editing: "var(--chart-5)",
  reviewing: "var(--chart-4)",
  retake: "var(--chart-3)",
  completed: "var(--chart-2)",
  paid: "var(--chart-1)",
};

const CHART_CONFIG: ChartConfig = Object.fromEntries(
  STATUS_ORDER.map((status) => [
    status,
    { label: chapterStatusLabel(status), color: STATUS_COLOR[status] },
  ]),
) as ChartConfig;

interface StatusFunnelProps {
  readonly funnel: StatusFunnelData;
}

export function StatusFunnel({ funnel }: StatusFunnelProps) {
  const data = STATUS_ORDER.map((status) => ({
    status,
    label: chapterStatusLabel(status),
    count: funnel[status],
  })).filter((entry) => entry.count > 0);

  const total = data.reduce((acc, entry) => acc + entry.count, 0);

  if (total === 0) {
    return (
      <section aria-label="Funil de status" className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Funil de status
        </h2>
        <p className="text-sm text-muted-foreground">Sem capítulos cadastrados.</p>
      </section>
    );
  }

  return (
    <section aria-label="Funil de status" className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
        Funil de status
      </h2>
      <div className="grid items-center gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
        <ChartContainer config={CHART_CONFIG} className="aspect-square w-full max-w-[260px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => {
                    const count = Number(value);
                    const percent = Math.round((count / total) * 100);
                    return `${item.payload.label}: ${count} (${percent}%)`;
                  }}
                  hideLabel
                />
              }
            />
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="55%"
              outerRadius="90%"
              strokeWidth={2}
              stroke="var(--background)"
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLOR[entry.status]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {STATUS_ORDER.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-full"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              <span className="text-muted-foreground">{chapterStatusLabel(status)}</span>
              <span className="ml-auto font-semibold text-foreground">{funnel[status]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
