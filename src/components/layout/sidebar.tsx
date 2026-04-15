"use client";

import { Headphones, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { BOTTOM_ITEMS, NAV_ITEMS } from "@/lib/constants/navigation";
import { cn } from "@/lib/utils";
import { SidebarToggle } from "./sidebar-toggle";

interface SidebarProps {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  }

  return (
    <aside
      data-testid="sidebar"
      className={cn(
        "flex h-full flex-col justify-between bg-sidebar py-6 transition-all duration-100",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Top section: logo + nav */}
      <div className="flex flex-col gap-2">
        {/* Logo + toggle */}
        <div
          className={cn(
            "flex px-5 pb-4",
            collapsed ? "flex-col items-center gap-3" : "items-center justify-between",
          )}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Headphones className="size-6 shrink-0 text-sidebar-primary" />
            {!collapsed && (
              <span className="text-[15px] font-bold text-sidebar-foreground whitespace-nowrap">
                AudioBook Track
              </span>
            )}
          </Link>
          <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-2.5 rounded-lg px-4 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0",
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="size-4.5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom section: settings + logout */}
      <div className="flex flex-col gap-1 px-3">
        {BOTTOM_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-11 items-center gap-2.5 rounded-lg px-4 text-sm transition-colors",
                active
                  ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                collapsed && "justify-center px-0",
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-4.5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "flex h-11 justify-start gap-2.5 rounded-lg px-4 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className="size-4.5 shrink-0" />
          {!collapsed && "Sair"}
        </Button>
      </div>
    </aside>
  );
}
