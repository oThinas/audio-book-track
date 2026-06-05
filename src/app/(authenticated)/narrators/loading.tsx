import { PageContainer } from "@/components/layout/page-container";
import { ListPageLoading } from "@/components/layout/page-loading";

export default function NarratorsLoading() {
  return (
    <PageContainer>
      <ListPageLoading
        title="Narradores"
        description="Gerencie os narradores disponíveis para gravações."
        actionLabel="Novo Narrador"
      />
    </PageContainer>
  );
}
