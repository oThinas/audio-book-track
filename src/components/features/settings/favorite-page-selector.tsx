"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NAVIGABLE_PAGES } from "@/lib/domain/navigable-pages";
import type { FavoritePage } from "@/lib/domain/user-preference";
import { useAutoSavePreference } from "@/lib/hooks/use-auto-save-preference";
import { PAGE_ICONS } from "@/lib/ui/page-icons";

interface FavoritePageSelectorProps {
  readonly initialValue: FavoritePage;
}

export function FavoritePageSelector({ initialValue }: FavoritePageSelectorProps) {
  const [value, setValue] = useState(initialValue);
  const { save } = useAutoSavePreference();

  function handleChange(newValue: FavoritePage | null) {
    if (!newValue) return;
    setValue(newValue);
    save({ favoritePage: newValue });
  }

  const Icon = PAGE_ICONS[value];

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger
        data-testid="favorite-page-select"
        className="data-[size=default]:h-10 w-50 gap-2 rounded-lg border-slate-200 bg-slate-50 px-4 capitalize"
      >
        <Icon className="size-4 text-slate-400" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {NAVIGABLE_PAGES.map((page) => {
            const PageIcon = PAGE_ICONS[page.slug];
            return (
              <SelectItem key={page.slug} value={page.slug}>
                <PageIcon className="size-4 text-slate-400" />
                {page.label}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
