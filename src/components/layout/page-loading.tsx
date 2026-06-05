import { Plus, Search } from "lucide-react";

import { PageDescription, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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

interface LoadingBlockProps {
  readonly className?: string;
}

/**
 * Main data-region skeleton block. Carries the page-loading-skeleton
 * testid — render exactly one per loading state (secondary regions use
 * the raw Skeleton primitive).
 */
export function LoadingBlock({ className }: LoadingBlockProps) {
  return (
    <Skeleton
      aria-hidden="true"
      data-testid="page-loading-skeleton"
      className={cn("h-96 w-full", className)}
    />
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

      <LoadingBlock />
      <LoadingStatus />
    </div>
  );
}
