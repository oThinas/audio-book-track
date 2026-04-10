"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarToggleProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <Button
      data-testid="sidebar-toggle"
      variant="ghost"
      size="icon"
      onClick={onToggle}
      className="size-8 text-sidebar-foreground/70 hover:bg-transparent hover:text-sidebar-accent-foreground [&_svg]:size-4.5"
      aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
    >
      {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
    </Button>
  );
}
