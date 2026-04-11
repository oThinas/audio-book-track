import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";
import type { ClassNameProps } from "@/types/class-name-props";

function PageContainer({ children, className }: PropsWithChildren<ClassNameProps>) {
  return <main className={cn("flex-1 p-8", className)}>{children}</main>;
}

function PageHeader({ children, className }: PropsWithChildren<ClassNameProps>) {
  return <div className={cn("mb-6", className)}>{children}</div>;
}

function PageTitle({ children, className }: PropsWithChildren<ClassNameProps>) {
  return <h1 className={cn("text-3xl font-bold tracking-tight", className)}>{children}</h1>;
}

function PageDescription({ children, className }: PropsWithChildren<ClassNameProps>) {
  return <p className={cn("text-muted-foreground mt-1", className)}>{children}</p>;
}

export { PageContainer, PageDescription, PageHeader, PageTitle };
