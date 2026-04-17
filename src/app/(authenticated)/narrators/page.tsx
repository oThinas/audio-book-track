import { PageContainer } from "@/components/layout/page-container";
import { createNarratorService } from "@/lib/factories/narrator";

import { NarratorsClient } from "./_components/narrators-client";

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
