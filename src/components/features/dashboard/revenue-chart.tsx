"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { RetrospectiveBucket } from "@/lib/services/dashboard-service";
import { formatCentsBRL } from "@/lib/utils/format-currency";

interface RevenueChartProps {
  readonly buckets: ReadonlyArray<RetrospectiveBucket>;
}

const CHART_CONFIG: ChartConfig = {
  cents: {
    label: "Receita",
    color: "var(--chart-1)",
  },
};

export default function RevenueChart({ buckets }: RevenueChartProps) {
  const data = buckets.map((b) => ({
    label: b.labelPtBr,
    cents: b.cents,
  }));

  return (
    <ChartContainer config={CHART_CONFIG} className="h-[260px] w-full">
      <LineChart data={data} margin={{ left: 12, right: 12, top: 12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
        <YAxis
          tickFormatter={(value: number) => formatCentsBRL(value)}
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <ChartTooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              formatter={(value) => formatCentsBRL(Number(value))}
              labelKey="label"
            />
          }
        />
        <Line
          dataKey="cents"
          type="monotone"
          stroke="var(--color-cents)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
