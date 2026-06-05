import { PageContainer, PageHeader, PageTitle } from "@/components/layout/page-container";
import { LoadingStatus } from "@/components/layout/page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Configurações</PageTitle>
      </PageHeader>

      {/* Aparência card region. */}
      <Skeleton aria-hidden="true" data-testid="page-loading-skeleton" className="h-96 w-full" />

      {/* Dashboard widgets section. */}
      <Skeleton aria-hidden="true" className="mt-6 h-48 w-full" />

      <LoadingStatus />
    </PageContainer>
  );
}
