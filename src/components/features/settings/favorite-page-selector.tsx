"use client";

import { useAutoSavePreference } from "@/components/features/settings/hooks/use-auto-save-preference";
import { useFavoritePageSelector } from "@/components/features/settings/hooks/use-favorite-page-selector";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { NAVIGABLE_PAGES, NAVIGABLE_PAGES_MAP } from "@/lib/domain/navigable-pages";
import type { FavoritePage } from "@/lib/domain/user-preference";
import { PAGE_ICONS } from "@/lib/ui/page-icons";

interface FavoritePageSelectorProps {
  readonly initialValue: FavoritePage;
}

export function FavoritePageSelector({ initialValue }: FavoritePageSelectorProps) {
  const { save } = useAutoSavePreference();
  const { value, handleChange } = useFavoritePageSelector({ initialValue, save });

  const Icon = PAGE_ICONS[value];

  return (
    <Select value={value} onValueChange={handleChange}>
      <SelectTrigger
        data-testid="favorite-page-select"
        aria-label="Página favorita"
        className="data-[size=default]:h-10 w-50 gap-2 rounded-lg border-border bg-background px-4 ml-auto md:ml-0"
      >
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span>{NAVIGABLE_PAGES_MAP.get(value)?.label}</span>
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {NAVIGABLE_PAGES.map((page) => {
            const PageIcon = PAGE_ICONS[page.slug];
            return (
              <SelectItem key={page.slug} value={page.slug}>
                <PageIcon className="size-4 text-muted-foreground" />
                {page.label}
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
