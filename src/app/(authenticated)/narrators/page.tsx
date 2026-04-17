import {
  PageContainer,
  PageDescription,
  PageHeader,
  PageTitle,
} from "@/components/layout/page-container";
import { createNarratorService } from "@/lib/factories/narrator";

import { NarratorsClient } from "./_components/narrators-client";

export const dynamic = "force-dynamic";

export default async function NarratorsPage() {
  const service = createNarratorService();
  const narrators = await service.list();

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Narradores</PageTitle>
        <PageDescription>Gerencie os narradores disponíveis para gravações.</PageDescription>
      </PageHeader>

      <NarratorsClient initialNarrators={narrators} />
    </PageContainer>
  );
}
