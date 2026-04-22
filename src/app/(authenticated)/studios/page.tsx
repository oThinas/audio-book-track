import { StudiosClient } from "@/components/features/studios/studios-client";
import { PageContainer } from "@/components/layout/page-container";
import { createStudioService } from "@/lib/factories/studio";

export const dynamic = "force-dynamic";

export default async function StudiosPage() {
  const service = createStudioService();
  const studios = await service.list();

  return (
    <PageContainer>
      <StudiosClient initialStudios={studios} />
    </PageContainer>
  );
}
