import { TriangleAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SectionErrorProps {
  readonly title?: string;
  readonly message?: string;
}

export function SectionError({
  title = "Não foi possível carregar esta seção",
  message = "Atualize a página em alguns instantes.",
}: SectionErrorProps) {
  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardHeader className="flex flex-row items-center gap-2">
        <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
        <CardTitle className="text-sm font-medium text-destructive">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
