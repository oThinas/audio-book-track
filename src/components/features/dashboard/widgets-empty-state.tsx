import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WidgetsEmptyState() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base font-medium">Nenhum widget selecionado</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p>
          Você desabilitou todos os widgets do dashboard. Escolha quais informações deseja
          acompanhar nas configurações.
        </p>
        <p>
          <Link
            href="/settings#dashboard-widgets"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Abrir configurações
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
