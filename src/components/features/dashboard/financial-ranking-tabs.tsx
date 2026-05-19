"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const ENTITY_HEADER: Record<RankingTabKey, string> = {
  estudio: "Estúdio",
  narrador: "Narrador",
  editor: "Editor",
};

function RankingTable({
  entries,
  entityLabel,
}: {
  entries: ReadonlyArray<RankingEntry>;
  entityLabel: string;
}) {
  if (entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Sem dados para o período selecionado.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{entityLabel}</TableHead>
          <TableHead className="text-right">Capítulos pagos</TableHead>
          <TableHead className="text-right">Receita</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.entityId}>
            <TableCell>
              <div className="flex items-center gap-2">
                <span>{entry.name}</span>
                {entry.archived && (
                  <Badge variant="outline" className="text-xs">
                    Arquivado
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{entry.chaptersPaidCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCentsBRL(entry.totalCents)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
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
    <Tabs value={active} onValueChange={(value) => setActive(value as RankingTabKey)}>
      <TabsList>
        <TabsTrigger value="estudio">{TAB_LABEL.estudio}</TabsTrigger>
        <TabsTrigger value="narrador">{TAB_LABEL.narrador}</TabsTrigger>
        <TabsTrigger value="editor">{TAB_LABEL.editor}</TabsTrigger>
      </TabsList>
      <TabsContent value="estudio">
        <RankingTable entries={studio} entityLabel={ENTITY_HEADER.estudio} />
      </TabsContent>
      <TabsContent value="narrador">
        <RankingTable entries={narrator} entityLabel={ENTITY_HEADER.narrador} />
      </TabsContent>
      <TabsContent value="editor">
        <RankingTable entries={editor} entityLabel={ENTITY_HEADER.editor} />
      </TabsContent>
    </Tabs>
  );
}
