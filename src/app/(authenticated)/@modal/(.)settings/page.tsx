import { loadUserPreferences } from "@/components/features/settings/load-preferences";
import { SettingsModal } from "@/components/features/settings/settings-modal";

/**
 * Intercepts client-side navigation to /settings and renders it as a modal over
 * the current page (contract C3). Deep-link/refresh bypasses this route and
 * falls through to the standalone settings page (FR-011).
 */
export default async function InterceptedSettingsPage() {
  const preferences = await loadUserPreferences();

  return <SettingsModal preferences={preferences} />;
}
