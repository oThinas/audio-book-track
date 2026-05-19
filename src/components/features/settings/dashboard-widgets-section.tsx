"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api/api-fetch";
import {
  DASHBOARD_WIDGET_META,
  DASHBOARD_WIDGETS,
  type DashboardWidgetKey,
} from "@/lib/domain/dashboard-widget";

interface DashboardWidgetsSectionProps {
  readonly initialWidgets: ReadonlyArray<DashboardWidgetKey>;
}

const SECTION_LABEL = {
  financial: "Financeiro",
  operational: "Operacional",
  retrospective: "Retrospectivo",
} as const;

export function DashboardWidgetsSection({ initialWidgets }: DashboardWidgetsSectionProps) {
  const [selected, setSelected] = useState<ReadonlySet<DashboardWidgetKey>>(
    () => new Set(initialWidgets),
  );
  const [persisted, setPersisted] = useState<ReadonlySet<DashboardWidgetKey>>(
    () => new Set(initialWidgets),
  );
  const [pending, startTransition] = useTransition();

  const isDirty = !setsEqual(selected, persisted);

  function toggle(key: DashboardWidgetKey, checked: boolean): void {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function onSave(): void {
    const payload = Array.from(selected);
    startTransition(async () => {
      const result = await apiFetch<{ data: { dashboardWidgets: DashboardWidgetKey[] } }>(
        "/api/v1/user-preferences",
        {
          method: "PATCH",
          body: { dashboardWidgets: payload },
        },
      );
      if (result.kind === "ok") {
        setPersisted(new Set(result.data.data.dashboardWidgets));
      }
    });
  }

  const grouped = groupBySection();

  return (
    <Card id="dashboard-widgets" className="p-6">
      <CardHeader className="p-0">
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>Marque os widgets que deseja exibir no seu dashboard.</CardDescription>
      </CardHeader>
      <Separator className="bg-border" />
      <CardContent className="flex flex-col gap-6 p-0">
        {(Object.keys(grouped) as Array<keyof typeof grouped>).map((section) => (
          <div key={section} className="flex flex-col gap-3">
            <p className="text-sm font-medium text-muted-foreground">{SECTION_LABEL[section]}</p>
            <ul className="flex flex-col gap-3">
              {grouped[section].map((meta) => (
                <li key={meta.key} className="flex items-start gap-3">
                  <Checkbox
                    id={`widget-${meta.key}`}
                    checked={selected.has(meta.key)}
                    onCheckedChange={(checked) => toggle(meta.key, checked === true)}
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor={`widget-${meta.key}`} className="font-medium">
                      {meta.titlePtBr}
                    </Label>
                    <p className="text-sm text-muted-foreground">{meta.descriptionPtBr}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="flex justify-end">
          <Button onClick={onSave} disabled={!isDirty || pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function groupBySection() {
  const result = {
    financial: [] as Array<(typeof DASHBOARD_WIDGET_META)[DashboardWidgetKey]>,
    operational: [] as Array<(typeof DASHBOARD_WIDGET_META)[DashboardWidgetKey]>,
    retrospective: [] as Array<(typeof DASHBOARD_WIDGET_META)[DashboardWidgetKey]>,
  };
  for (const key of DASHBOARD_WIDGETS) {
    const meta = DASHBOARD_WIDGET_META[key];
    result[meta.section].push(meta);
  }
  return result;
}

function setsEqual<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) {
    if (!b.has(value)) return false;
  }
  return true;
}
