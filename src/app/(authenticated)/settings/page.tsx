import { headers } from "next/headers";
import { FavoritePageSelector } from "@/components/features/settings/favorite-page-selector";
import { FontSizeSelector } from "@/components/features/settings/font-size-selector";
import { PrimaryColorSelector } from "@/components/features/settings/primary-color-selector";
import { ThemeSelector } from "@/components/features/settings/theme-selector";
import { PageContainer, PageHeader, PageTitle } from "@/components/layout/page-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/lib/auth/server";
import type { UserPreference } from "@/lib/domain/user-preference";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

async function getPreferences(): Promise<UserPreference> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const { DEFAULT_USER_PREFERENCE } = await import("@/lib/domain/user-preference");
    return DEFAULT_USER_PREFERENCE;
  }
  const service = createUserPreferenceService();
  return service.getOrDefault(session.user.id);
}

export default async function SettingsPage() {
  const preferences = await getPreferences();

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>Configurações</PageTitle>
      </PageHeader>

      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Personalize como o sistema aparece para você</CardDescription>
        </CardHeader>

        <Separator className="bg-slate-100" />

        <CardContent className="flex flex-col gap-5 p-0">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-800">Tema</span>
              <span className="text-[13px] text-slate-500">
                Escolha entre tema claro, escuro ou do sistema
              </span>
            </div>
            <ThemeSelector initialValue={preferences.theme} />
          </div>

          <Separator className="bg-slate-100" />

          {/* Font size */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-800">Tamanho da fonte</span>
              <span className="text-[13px] text-slate-500">
                Ajuste o tamanho do texto na interface
              </span>
            </div>
            <FontSizeSelector initialValue={preferences.fontSize} />
          </div>

          <Separator className="bg-slate-100" />

          {/* Favorite page */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-800">Página favorita</span>
              <span className="text-[13px] text-slate-500">
                Escolha a página exibida ao fazer login
              </span>
            </div>
            <FavoritePageSelector initialValue={preferences.favoritePage} />
          </div>

          <Separator className="bg-slate-100" />

          {/* Primary color */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-800">Cor primária</span>
              <span className="text-[13px] text-slate-500">
                Define a cor de destaque em toda a interface
              </span>
            </div>
            <PrimaryColorSelector initialValue={preferences.primaryColor} />
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
