import { NarratorsClient } from "@/components/features/narrators/narrators-client";
import { PageContainer } from "@/components/layout/page-container";
import { createNarratorService } from "@/lib/factories/narrator";

export const dynamic = "force-dynamic";

export default async function NarratorsPage() {
  const service = createNarratorService();
  const narrators = await service.list();

  return (
    <PageContainer>
      <NarratorsClient initialNarrators={narrators} />
    </PageContainer>
  );
}
