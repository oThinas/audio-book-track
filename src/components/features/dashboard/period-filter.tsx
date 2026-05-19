"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PeriodPreset } from "@/lib/domain/dashboard-period";

import { usePeriodFilter } from "./hooks/use-period-filter";

const PRESET_LABELS: ReadonlyArray<{ value: PeriodPreset; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "this-week", label: "Esta semana" },
  { value: "this-month", label: "Este mês" },
  { value: "this-quarter", label: "Trimestre" },
  { value: "this-year", label: "Este ano" },
];

interface PeriodFilterProps {
  readonly todayIso: string;
}

export function PeriodFilter({ todayIso }: PeriodFilterProps) {
  const { period, setPreset, setRange } = usePeriodFilter(todayIso);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isCustom = period.preset === "custom";
  const activeTab = isCustom ? "" : period.preset;

  const selectedRange: DateRange | undefined = useMemo(() => {
    if (!isCustom) return undefined;
    return { from: parseISO(period.fromIso), to: parseISO(period.toIso) };
  }, [isCustom, period.fromIso, period.toIso]);

  const customLabel = isCustom
    ? `${format(parseISO(period.fromIso), "dd/MM/yyyy", { locale: ptBR })} – ${format(
        parseISO(period.toIso),
        "dd/MM/yyyy",
        { locale: ptBR },
      )}`
    : "Personalizado";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (value) setPreset(value as PeriodPreset);
        }}
      >
        <TabsList className="flex-wrap">
          {PRESET_LABELS.map((option) => (
            <TabsTrigger key={option.value} value={option.value}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={isCustom ? "secondary" : "outline"}
            size="sm"
            aria-label="Selecionar período customizado"
          >
            <CalendarIcon className="size-4" aria-hidden="true" />
            <span className="ml-2">{customLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={selectedRange}
            numberOfMonths={2}
            locale={ptBR}
            onSelect={(range) => {
              if (range?.from && range?.to) {
                setRange(format(range.from, "yyyy-MM-dd"), format(range.to, "yyyy-MM-dd"));
                setPopoverOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
