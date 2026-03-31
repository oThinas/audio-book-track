import { Home } from "lucide-react";
import Link from "next/link";

import { LogoutButton } from "@/components/features/auth/logout-button";

interface SidebarProps {
  userName: string;
}

export function Sidebar({ userName }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col border-r bg-muted/40">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="text-lg font-semibold">
          AudioBook Track
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Home className="size-4" />
          Dashboard
        </Link>
      </nav>

      <div className="border-t p-4">
        <p className="mb-2 truncate px-3 text-sm text-muted-foreground">{userName}</p>
        <LogoutButton />
      </div>
    </aside>
  );
}
