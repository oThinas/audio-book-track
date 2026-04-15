"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type RefObject, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { BOTTOM_ITEMS, NAV_ITEMS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";

interface MobileSidebarProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly menuButtonRef?: RefObject<HTMLButtonElement | null>;
}

/**
 * Mobile navigation panel — fullscreen overlay below the header.
 *
 * Uses <div> with CSS position:fixed + transform instead of shadcn Sheet.
 * See plan.md D5 for full justification: Sheet (Radix Dialog) renders via
 * React Portal over the entire viewport (including the header), includes an
 * unnecessary backdrop, and has a fixed width. Customizing it to work below
 * the header would mean fighting the component rather than using it.
 * This is a layout component, not an interactive primitive — the interactive
 * elements inside (Button) still use shadcn/ui components.
 */
export function MobileSidebar({ isOpen, onClose, menuButtonRef }: MobileSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  async function handleLogout() {
    onClose();
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  }

  const handleFocusTrap = useCallback((event: KeyboardEvent) => {
    if (event.key !== "Tab" || !panelRef.current) return;

    const focusable = panelRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );

    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    const firstFocusable = panelRef.current?.querySelector<HTMLElement>(
      "a[href], button:not([disabled])",
    );
    firstFocusable?.focus();

    document.addEventListener("keydown", handleFocusTrap);
    return () => document.removeEventListener("keydown", handleFocusTrap);
  }, [isOpen, handleFocusTrap]);

  useEffect(() => {
    if (isOpen) return;

    if (menuButtonRef?.current) {
      menuButtonRef.current.focus();
    }
  }, [isOpen, menuButtonRef]);

  return (
    <div
      ref={panelRef}
      data-testid="mobile-sidebar"
      className={cn(
        "fixed inset-x-0 top-14 bottom-0 z-30 flex flex-col justify-between bg-sidebar py-6 transition-transform duration-150 ease-in-out motion-reduce:transition-none md:hidden",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-lg px-4 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: settings + logout */}
      <div className="flex flex-col gap-1 px-3">
        {BOTTOM_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-lg px-4 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-4.5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="flex h-11 justify-start gap-2.5 rounded-lg px-4 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="size-4.5 shrink-0" />
          Sair
        </Button>
      </div>
    </div>
  );
}
