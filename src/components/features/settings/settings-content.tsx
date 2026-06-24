import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { UserPreference } from "@/lib/domain/user-preference";
import { DashboardWidgetsSection } from "./dashboard-widgets-section";
import { FavoritePageSelector } from "./favorite-page-selector";
import { FontSizeSelector } from "./font-size-selector";
import { PrimaryColorSelector } from "./primary-color-selector";
import { ThemeSelector } from "./theme-selector";

interface SettingsContentProps {
  readonly preferences: UserPreference;
}

/**
 * Presentational settings sections shared by the standalone page and the
 * intercepted modal (D4). Pure composition — preferences arrive by prop; the
 * server fetch stays in each host (page / modal route).
 */
export function SettingsContent({ preferences }: SettingsContentProps) {
  return (
    <>
      <Card className="p-6">
        <CardHeader className="p-0">
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Personalize como o sistema aparece para você</CardDescription>
        </CardHeader>

        <Separator className="bg-border" />

        <CardContent className="flex flex-col gap-5 p-0">
          {/* Theme */}
          <div className="flex flex-col justify-between gap-2 lg:items-center lg:gap-0 lg:flex-row">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Tema</span>
              <span className="text-[13px] text-muted-foreground">
                Escolha entre tema claro, escuro ou do sistema
              </span>
            </div>
            <ThemeSelector initialValue={preferences.theme} />
          </div>

          <Separator className="bg-border" />

          {/* Font size */}
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center md:gap-0">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Tamanho da fonte</span>
              <span className="text-[13px] text-muted-foreground">
                Ajuste o tamanho do texto na interface
              </span>
            </div>
            <FontSizeSelector initialValue={preferences.fontSize} />
          </div>

          <Separator className="bg-border" />

          {/* Favorite page */}
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center md:gap-0">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Página favorita</span>
              <span className="text-[13px] text-muted-foreground">
                Escolha a página exibida ao fazer login
              </span>
            </div>
            <FavoritePageSelector initialValue={preferences.favoritePage} />
          </div>

          <Separator className="bg-border" />

          {/* Primary color */}
          <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center md:gap-0">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Cor primária</span>
              <span className="text-[13px] text-muted-foreground">
                Define a cor de destaque em toda a interface
              </span>
            </div>
            <PrimaryColorSelector initialValue={preferences.primaryColor} />
          </div>
        </CardContent>
      </Card>

      <div className="mt-6">
        <DashboardWidgetsSection initialWidgets={preferences.dashboardWidgets} />
      </div>
    </>
  );
}
