"use client";

import type { PropsWithChildren } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { useSidebar } from "@/lib/hooks/use-sidebar";

interface AuthenticatedLayoutClientProps {
  readonly initialCollapsed: boolean;
}

export function AuthenticatedLayoutClient({
  initialCollapsed,
  children,
}: PropsWithChildren<AuthenticatedLayoutClientProps>) {
  const { collapsed, toggle } = useSidebar(initialCollapsed);

  return (
    <div className="flex h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex-1 overflow-auto bg-background">{children}</div>
    </div>
  );
}
