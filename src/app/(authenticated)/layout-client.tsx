"use client";

import { usePathname } from "next/navigation";
import { type PropsWithChildren, useEffect, useRef, useState, ViewTransition } from "react";
import { useMobileMenu } from "@/components/layout/hooks/use-mobile-menu";
import { useSidebar } from "@/components/layout/hooks/use-sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { Sidebar } from "@/components/layout/sidebar";
import { type NavTransitionType, resolveNavTransition } from "@/lib/navigation/nav-transition";

/**
 * Maps navigation transition types (from resolveNavTransition, applied via
 * Link `transitionTypes` -> React.addTransitionType) to view-transition CSS
 * classes. Route navigation updates the persistent content boundary, so the
 * `default` prop drives it. Any unmapped type (e.g. "none") falls back to the
 * neutral crossfade. Directional classes are defined in globals.css.
 */
const CONTENT_TRANSITION_CLASSES = {
  "nav-up": "nav-up",
  "nav-down": "nav-down",
  "depth-forward": "depth-forward",
  "depth-back": "depth-back",
  default: "vt-crossfade",
} as const;

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

  // Direction of the last navigation, mirrored onto `data-vt-type` for
  // deterministic E2E assertions (FR-002/FR-017). Held in state so it persists
  // across unrelated re-renders instead of collapsing back to "none".
  const [navTransitionType, setNavTransitionType] = useState<NavTransitionType>("none");

  useEffect(() => {
    if (pathname !== previousPathnameRef.current) {
      setNavTransitionType(resolveNavTransition(previousPathnameRef.current, pathname));
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
      {/* The boundary wraps the scroll container (not the tall content inside it)
          so its view-transition snapshot is viewport-sized. Otherwise a tall
          snapshot, captured top-anchored, flashes the page top (book title) over
          the scrolled content on in-page updates like chapter reorder (US5). */}
      <ViewTransition default={CONTENT_TRANSITION_CLASSES}>
        <div className="flex-1 overflow-auto bg-background" data-vt-type={navTransitionType}>
          {children}
        </div>
      </ViewTransition>
    </div>
  );
}
