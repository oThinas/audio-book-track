import type { PropsWithChildren } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  readonly className?: string;
}

function PageContainer({ children, className }: PropsWithChildren<PageContainerProps>) {
  return <main className={cn("flex-1 p-8", className)}>{children}</main>;
}

interface PageHeaderProps {
  readonly className?: string;
}

function PageHeader({ children, className }: PropsWithChildren<PageHeaderProps>) {
  return <div className={cn("mb-6", className)}>{children}</div>;
}

interface PageTitleProps {
  readonly className?: string;
}

function PageTitle({ children, className }: PropsWithChildren<PageTitleProps>) {
  return <h1 className={cn("text-3xl font-bold tracking-tight", className)}>{children}</h1>;
}

interface PageDescriptionProps {
  readonly className?: string;
}

function PageDescription({ children, className }: PropsWithChildren<PageDescriptionProps>) {
  return <p className={cn("text-muted-foreground mt-1", className)}>{children}</p>;
}

export { PageContainer, PageDescription, PageHeader, PageTitle };
