"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { HamburgerIcon } from "./hamburger-icon";

interface MobileHeaderProps {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
}

export function MobileHeader({ isOpen, onToggle, buttonRef }: MobileHeaderProps) {
  return (
    <header
      data-testid="mobile-header"
      className="sticky top-0 z-40 flex h-14 gap-2 items-center bg-sidebar px-4 md:hidden"
    >
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground aria-expanded:text-sidebar-foreground aria-expanded:bg-transparent"
      >
        <HamburgerIcon isOpen={isOpen} />
      </Button>

      <span className="text-sm font-bold text-sidebar-foreground whitespace-nowrap">
        AudioBook Track
      </span>
    </header>
  );
}
