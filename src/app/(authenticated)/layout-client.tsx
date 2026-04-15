"use client";

import { usePathname } from "next/navigation";
import { type PropsWithChildren, useEffect, useRef } from "react";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
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
  const {
    isOpen: isMobileMenuOpen,
    toggle: toggleMobileMenu,
    close: closeMobileMenu,
  } = useMobileMenu();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      previousPathnameRef.current = pathname;
      closeMobileMenu();
    }
  }, [pathname, closeMobileMenu]);

  return (
    <div className="flex h-screen flex-col md:flex-row">
      <MobileHeader
        isOpen={isMobileMenuOpen}
        onToggle={toggleMobileMenu}
        buttonRef={menuButtonRef}
      />
      <MobileSidebar
        isOpen={isMobileMenuOpen}
        onClose={closeMobileMenu}
        menuButtonRef={menuButtonRef}
      />
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="flex-1 overflow-auto bg-background">{children}</div>
    </div>
  );
}
