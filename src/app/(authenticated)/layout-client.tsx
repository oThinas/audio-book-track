"use client";

import type { PropsWithChildren } from "react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { Sidebar } from "@/components/layout/sidebar";
import { useMobileMenu } from "@/lib/hooks/use-mobile-menu";
import { useSidebar } from "@/lib/hooks/use-sidebar";

interface AuthenticatedLayoutClientProps {
  readonly initialCollapsed: boolean;
}

export function AuthenticatedLayoutClient({
  initialCollapsed,
  children,
}: PropsWithChildren<AuthenticatedLayoutClientProps>) {
  const { collapsed, toggle: toggleSidebar } = useSidebar(initialCollapsed);
  const { isOpen: isMobileMenuOpen, toggle: toggleMobileMenu } = useMobileMenu();

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <MobileHeader isOpen={isMobileMenuOpen} onToggle={toggleMobileMenu} />
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 overflow-auto bg-background">{children}</div>
    </div>
  );
}
