import { Plus, Search } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Accessible loading announcement region. Rendered exactly once per
 * route loading state so screen readers announce navigation feedback
 * a single time (FR-008).
 */
export function LoadingStatus() {
  return (
    <div role="status" data-testid="page-loading-status">
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

interface ListPageLoadingProps {
  readonly title: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly searchPlaceholder?: string;
  readonly searchLabel?: string;
}

/**
 * Shared loading frame for listing routes. Mirrors the real listing
 * frame (books-client.tsx and siblings) so the loading → content swap
 * causes no layout shift: real title, description and disabled
 * controls, with a single skeleton block over the table region.
 * Optional props omitted → corresponding element is not rendered.
 */
export function ListPageLoading({
  title,
  description,
  actionLabel,
  searchPlaceholder,
  searchLabel,
}: ListPageLoadingProps) {
  return (
    <div className="flex flex-col">
      <PageHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <PageTitle>{title}</PageTitle>
          {description && <PageDescription>{description}</PageDescription>}
        </div>
        {actionLabel && (
          <Button type="button" disabled className="p-5">
            <Plus aria-hidden="true" />
            {actionLabel}
          </Button>
        )}
      </PageHeader>

      {searchPlaceholder && (
        <div className="relative mb-3 max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            disabled
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="pl-9"
          />
        </div>
      )}

      <Skeleton aria-hidden="true" data-testid="page-loading-skeleton" className="h-96 w-full" />
      <LoadingStatus />
    </div>
  );
}
