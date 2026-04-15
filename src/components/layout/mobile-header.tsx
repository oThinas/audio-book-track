"use client";

import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MobileHeaderProps {
  readonly isOpen: boolean;
  readonly onToggle: () => void;
}

export function MobileHeader({ isOpen, onToggle }: MobileHeaderProps) {
  return (
    <header
      data-testid="mobile-header"
      className="sticky top-0 z-40 flex h-14 gap-2 items-center bg-sidebar px-4 md:hidden"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
        aria-expanded={isOpen}
        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </Button>

      <span className="text-sm font-bold text-sidebar-foreground whitespace-nowrap">
        AudioBook Track
      </span>
    </header>
  );
}
