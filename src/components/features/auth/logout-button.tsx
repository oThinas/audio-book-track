"use client";

import { LogOut } from "lucide-react";
import { useLogout } from "@/components/features/auth/hooks/use-logout";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const { handleLogout, isLoading } = useLogout();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
    >
      <LogOut className="size-4" />
      Sair
    </Button>
  );
}
