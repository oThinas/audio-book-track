"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RankingEntry } from "@/lib/repositories/dashboard-repository";
import { formatCentsBRL } from "@/lib/utils/format-currency";

interface FinancialRankingTabsProps {
  readonly studio: ReadonlyArray<RankingEntry>;
  readonly narrator: ReadonlyArray<RankingEntry>;
  readonly editor: ReadonlyArray<RankingEntry>;
  readonly defaultTab?: "estudio" | "narrador" | "editor";
}

type RankingTabKey = "estudio" | "narrador" | "editor";

const TAB_LABEL: Record<RankingTabKey, string> = {
  estudio: "Estúdios",
  narrador: "Narradores",
  editor: "Editores",
};

const CHART_CONFIG: ChartConfig = {
  totalCents: {
    label: "Receita",
    color: "var(--chart-1)",
  },
};

// Highest-ranked entry gets the most saturated shade (--chart-1) and the
// ramp fades toward --chart-6 as ranking decreases. Cap at 6 — beyond that,
// reuse the lightest shade (10 items max anyway).
const RANK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
] as const;

function colorForRank(index: number): string {
  return RANK_COLORS[Math.min(index, RANK_COLORS.length - 1)] as string;
}

function RankingChart({ entries }: { entries: ReadonlyArray<RankingEntry> }) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem dados para o período selecionado.
      </p>
    );
  }

  const data = entries.map((entry, index) => ({
    entityId: entry.entityId,
    name: entry.archived ? `${entry.name} (arquivado)` : entry.name,
    totalCents: entry.totalCents,
    chaptersPaidCount: entry.chaptersPaidCount,
    fill: colorForRank(index),
  }));

  // Fixed height per row keeps the chart compact regardless of card height;
  // wrapper uses h-full + justify-center so the (compact) chart is vertically
  // centered inside the card's remaining space.
  const height = Math.max(180, data.length * 38 + 24);

  return (
    <div className="flex h-full flex-col justify-center gap-4">
      <ChartContainer
        config={CHART_CONFIG}
        className="aspect-auto w-full"
        style={{ height: `${height}px` }}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 12, top: 4 }}>
          <CartesianGrid horizontal={false} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tickFormatter={(value: number) => formatCentsBRL(value)}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
          />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={120}
            tickMargin={6}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", fillOpacity: 0.35 }}
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const total = formatCentsBRL(Number(value));
                  const count = item.payload.chaptersPaidCount;
                  return `${total} · ${count} capítulo(s)`;
                }}
                labelKey="name"
              />
            }
          />
          <Bar dataKey="totalCents" radius={[0, 4, 4, 0]}>
            {data.map((entry) => (
              <Cell key={entry.entityId} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>

      {entries.some((entry) => entry.archived) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-[10px]">
            Arquivado
          </Badge>
          Entidades soft-deleted ainda aparecem no ranking histórico.
        </p>
      )}
    </div>
  );
}

export function FinancialRankingTabs({
  studio,
  narrator,
  editor,
  defaultTab = "estudio",
}: FinancialRankingTabsProps) {
  const [active, setActive] = useState<RankingTabKey>(defaultTab);

  return (
    <Tabs
      value={active}
      onValueChange={(value) => setActive(value as RankingTabKey)}
      className="h-full"
    >
      <TabsList>
        <TabsTrigger value="estudio">{TAB_LABEL.estudio}</TabsTrigger>
        <TabsTrigger value="narrador">{TAB_LABEL.narrador}</TabsTrigger>
        <TabsTrigger value="editor">{TAB_LABEL.editor}</TabsTrigger>
      </TabsList>
      <TabsContent value="estudio">
        <RankingChart entries={studio} />
      </TabsContent>
      <TabsContent value="narrador">
        <RankingChart entries={narrator} />
      </TabsContent>
      <TabsContent value="editor">
        <RankingChart entries={editor} />
      </TabsContent>
    </Tabs>
  );
}
