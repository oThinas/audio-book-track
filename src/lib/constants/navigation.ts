import type { LucideIcon } from "lucide-react";
import { PAGE_ICONS } from "@/lib/ui/page-icons";

export interface NavigationItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: PAGE_ICONS.dashboard },
  { href: "/books", label: "Livros", icon: PAGE_ICONS.books },
  { href: "/studios", label: "Estúdios", icon: PAGE_ICONS.studios },
  { href: "/editors", label: "Editores", icon: PAGE_ICONS.editors },
  { href: "/narrators", label: "Narradores", icon: PAGE_ICONS.narrators },
] as const;

export const BOTTOM_ITEMS: readonly NavigationItem[] = [
  { href: "/settings", label: "Configurações", icon: PAGE_ICONS.settings },
] as const;
