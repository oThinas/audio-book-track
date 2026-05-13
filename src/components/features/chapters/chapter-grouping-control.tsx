"use client";

import { ChevronDown } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GroupingDimension } from "@/lib/url/grouping-param";

const DIMENSION_LABEL: Record<GroupingDimension, string> = {
  narrator: "Narrador",
  editor: "Editor",
  status: "Status",
};

const DIMENSION_ORDER: ReadonlyArray<GroupingDimension> = ["narrator", "editor", "status"];

export interface ChapterGroupingControlProps {
  readonly grouping: ReadonlyArray<GroupingDimension>;
  readonly onGroupingChange: (next: GroupingDimension[]) => void;
}

function triggerText(grouping: ReadonlyArray<GroupingDimension>): string {
  if (grouping.length === 0) return "Agrupar por";
  return `Agrupando: ${grouping.map((dim) => DIMENSION_LABEL[dim]).join(" → ")}`;
}

export function ChapterGroupingControl({
  grouping,
  onGroupingChange,
}: ChapterGroupingControlProps) {
  function toggleDimension(dim: GroupingDimension) {
    const idx = grouping.indexOf(dim);
    if (idx === -1) {
      onGroupingChange([...grouping, dim]);
    } else {
      onGroupingChange(grouping.filter((d) => d !== dim));
    }
  }

  function clearAll() {
    onGroupingChange([]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="chapter-grouping-trigger"
        className={buttonVariants({ variant: "outline", size: "sm", className: "gap-1.5" })}
      >
        <span className="truncate">{triggerText(grouping)}</span>
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[14rem]">
        <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          data-testid="chapter-grouping-clear"
          disabled={grouping.length === 0}
          onSelect={(event) => {
            event.preventDefault();
            clearAll();
          }}
        >
          Sem agrupamento
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {DIMENSION_ORDER.map((dim) => {
          const orderIdx = grouping.indexOf(dim);
          const checked = orderIdx !== -1;
          return (
            <DropdownMenuCheckboxItem
              key={dim}
              data-testid={`chapter-grouping-item-${dim}`}
              checked={checked}
              onSelect={(event) => {
                event.preventDefault();
                toggleDimension(dim);
              }}
            >
              <span className="flex-1">{DIMENSION_LABEL[dim]}</span>
              {checked && (
                <span
                  data-testid={`chapter-grouping-order-${dim}`}
                  className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
                  title={`Posição ${orderIdx + 1} na hierarquia`}
                >
                  {orderIdx + 1}
                </span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
