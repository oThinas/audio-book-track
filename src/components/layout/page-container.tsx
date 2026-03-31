import { cn } from "@/lib/utils";

function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("flex-1 p-6", className)}>{children}</main>;
}

function PageHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-6", className)}>{children}</div>;
}

function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h1 className={cn("text-3xl font-bold tracking-tight", className)}>{children}</h1>;
}

function PageDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-muted-foreground mt-1", className)}>{children}</p>;
}

export { PageContainer, PageHeader, PageTitle, PageDescription };