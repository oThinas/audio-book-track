import { PageContainer } from "@/components/layout/page-container";
import { ListPageLoading } from "@/components/layout/page-loading";

export default function StudiosLoading() {
  return (
    <PageContainer>
      <ListPageLoading
        title="Estúdios"
        description="Gerencie os estúdios parceiros."
        actionLabel="Novo Estúdio"
      />
    </PageContainer>
  );
}
