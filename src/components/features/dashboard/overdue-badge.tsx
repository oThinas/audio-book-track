import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { DashboardWidgetKey } from "@/lib/domain/dashboard-widget";
import { createDashboardService } from "@/lib/factories/dashboard";

interface OverdueBadgeProps {
  readonly enabledWidgets: ReadonlyArray<DashboardWidgetKey>;
}

export async function OverdueBadge({ enabledWidgets }: OverdueBadgeProps) {
  if (!enabledWidgets.includes("atrasados")) return null;

  const snapshot = await createDashboardService().getOperational(["atrasados"]);
  if (snapshot.overdueCount === 0 || snapshot.firstOverdueBookId === null) return null;

  return (
    <Badge
      variant="destructive"
      className="h-8 gap-1.5 px-3 text-sm"
      render={<Link href={`/books/${snapshot.firstOverdueBookId}?focus=week`} />}
    >
      <AlertTriangle aria-hidden="true" />
      <span className="font-medium">
        {snapshot.overdueCount} capítulo{snapshot.overdueCount === 1 ? "" : "s"} atrasado
        {snapshot.overdueCount === 1 ? "" : "s"}
      </span>
    </Badge>
  );
}
