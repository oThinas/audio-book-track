"use client";

import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      {PRESET_LABELS.map((option) => {
        const isActive = !isCustom && period.preset === option.value;
        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={isActive}
            onClick={() => setPreset(option.value)}
          >
            {option.label}
          </Button>
        );
      })}

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger
          className={buttonVariants({
            variant: isCustom ? "secondary" : "outline",
            size: "sm",
            className: "gap-2",
          })}
        >
          <CalendarIcon className="size-4" aria-hidden="true" />
          <span>{customLabel}</span>
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
