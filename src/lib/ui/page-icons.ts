import {
  BookOpen,
  Building2,
  LayoutDashboard,
  type LucideIcon,
  Mic,
  Pencil,
  Settings,
} from "lucide-react";
import type { FavoritePage } from "@/lib/domain/user-preference";

export const PAGE_ICONS: Record<FavoritePage, LucideIcon> = {
  dashboard: LayoutDashboard,
  books: BookOpen,
  studios: Building2,
  editors: Pencil,
  narrators: Mic,
  settings: Settings,
};
