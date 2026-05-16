"use client";

import { format as formatDate, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDeadline } from "@/lib/utils/format-date";
import { cn } from "@/lib/utils/index";

interface ChapterDeadlinePickerProps {
  readonly value: string | null;
  readonly onChange: (next: string | null) => void;
  readonly disabled?: boolean;
  readonly id?: string;
}

function toIsoDate(date: Date): string {
  return formatDate(date, "yyyy-MM-dd");
}

export function ChapterDeadlinePicker({
  value,
  onChange,
  disabled,
  id,
}: ChapterDeadlinePickerProps) {
  const selectedDate = value ? parseISO(value) : undefined;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
            )}
          >
            <CalendarIcon aria-hidden="true" className="mr-2 size-4" />
            {value ? formatDeadline(value) : "Definir prazo"}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => onChange(date ? toIsoDate(date) : null)}
          locale={ptBR as never}
          weekStartsOn={1}
          captionLayout="dropdown"
        />
        <div className="flex items-center justify-between border-t p-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
