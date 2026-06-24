"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UserPreference } from "@/lib/domain/user-preference";
import { useSettingsModal } from "./hooks/use-settings-modal";
import { SettingsContent } from "./settings-content";

interface SettingsModalProps {
  readonly preferences: UserPreference;
}

/**
 * Intercepted /settings rendered as a Dialog over the current page. The Radix
 * overlay covers the whole viewport (including the sidebar), so navigation is
 * blocked until it closes (FR-009/FR-016).
 */
export function SettingsModal({ preferences }: SettingsModalProps) {
  const { open, onOpenChange } = useSettingsModal();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Personalize a aparência e o comportamento do sistema
          </DialogDescription>
        </DialogHeader>

        <SettingsContent preferences={preferences} />
      </DialogContent>
    </Dialog>
  );
}
