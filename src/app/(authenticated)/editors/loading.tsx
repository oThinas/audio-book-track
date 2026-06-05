import { PageContainer } from "@/components/layout/page-container";
import { ListPageLoading } from "@/components/layout/page-loading";

export default function EditorsLoading() {
  return (
    <PageContainer>
      <ListPageLoading
        title="Editores"
        description="Gerencie os editores disponíveis para revisão."
        actionLabel="Novo Editor"
      />
    </PageContainer>
  );
}
