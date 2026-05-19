import { AlertTriangle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface OverdueCardProps {
  readonly count: number;
  readonly firstOverdueBookId: string | null;
}

export function OverdueCard({ count, firstOverdueBookId }: OverdueCardProps) {
  const hasOverdue = count > 0;
  return (
    <Card
      className={cn(
        "flex flex-col justify-between",
        hasOverdue && "border-destructive/40 bg-destructive/10",
      )}
    >
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle
          className={cn("size-4", hasOverdue ? "text-destructive" : "text-muted-foreground")}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-muted-foreground">Capítulos atrasados</p>
      </CardHeader>
      <CardContent className="flex items-baseline justify-between gap-4">
        <p className="text-3xl font-semibold tracking-tight text-foreground">{count}</p>
        {hasOverdue && firstOverdueBookId !== null ? (
          <Button asChild size="sm" variant="secondary">
            <Link href={`/books/${firstOverdueBookId}?focus=week`}>Ver lista</Link>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" disabled>
            Ver lista
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
