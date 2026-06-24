import { loadUserPreferences } from "@/components/features/settings/load-preferences";
import { SettingsContent } from "@/components/features/settings/settings-content";
import { PageContainer, PageHeader, PageTitle } from "@/components/layout/page-container";

export default async function SettingsPage() {
  const preferences = await loadUserPreferences();

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Configurações</PageTitle>
      </PageHeader>

      <SettingsContent preferences={preferences} />
    </PageContainer>
  );
}
