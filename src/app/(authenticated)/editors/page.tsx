import { EditorsClient } from "@/components/features/editors/editors-client";
import { PageContainer } from "@/components/layout/page-container";
import { createEditorService } from "@/lib/factories/editor";

export const dynamic = "force-dynamic";

export default async function EditorsPage() {
  const service = createEditorService();
  const editors = await service.list();

  return (
    <PageContainer>
      <EditorsClient initialEditors={editors} />
    </PageContainer>
  );
}
