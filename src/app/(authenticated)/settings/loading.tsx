import { PageContainer, PageHeader, PageTitle } from "@/components/layout/page-container";
import { LoadingBlock, LoadingStatus } from "@/components/layout/page-loading";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Configurações</PageTitle>
      </PageHeader>

      {/* Aparência card region. */}
      <LoadingBlock />

      {/* Dashboard widgets section. */}
      <Skeleton aria-hidden="true" className="mt-6 h-48 w-full" />

      <LoadingStatus />
    </PageContainer>
  );
}
