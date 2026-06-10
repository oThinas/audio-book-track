import { PageContainer } from "@/components/layout/page-container";
import { LoadingStatus } from "@/components/layout/page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function BookDetailLoading() {
  return (
    <PageContainer>
      <div className="flex flex-col">
        {/* Structured silhouette of book-header.tsx: title, studio meta and stats card. */}
        <header className="mb-6 flex flex-col gap-4">
          <Skeleton aria-hidden="true" className="h-9 w-64" />
          <Skeleton aria-hidden="true" className="h-5 w-48" />
          <Skeleton aria-hidden="true" className="h-5 max-w-md" />
        </header>

        {/* Toolbar + chapters table region. */}
        <Skeleton aria-hidden="true" data-testid="page-loading-skeleton" className="h-96 w-full" />
        <LoadingStatus />
      </div>
    </PageContainer>
  );
}
