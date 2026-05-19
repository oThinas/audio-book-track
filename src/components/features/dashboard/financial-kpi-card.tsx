import type { PropsWithChildren } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ClassNameProps } from "@/types/class-name-props";

function FinancialKpiCard({ children, className }: PropsWithChildren<ClassNameProps>) {
  return <Card className={cn("flex flex-col justify-between", className)}>{children}</Card>;
}

function Label({ children }: PropsWithChildren) {
  return (
    <CardHeader>
      <p className="text-sm font-medium text-muted-foreground">{children}</p>
    </CardHeader>
  );
}

function Value({ children, className }: PropsWithChildren<ClassNameProps>) {
  return (
    <CardContent>
      <p className={cn("text-3xl font-semibold tracking-tight text-foreground", className)}>
        {children}
      </p>
    </CardContent>
  );
}

function Hint({ children }: PropsWithChildren) {
  return (
    <CardContent className="pt-0">
      <p className="text-xs text-muted-foreground">{children}</p>
    </CardContent>
  );
}

FinancialKpiCard.Label = Label;
FinancialKpiCard.Value = Value;
FinancialKpiCard.Hint = Hint;

export { FinancialKpiCard };
