import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { DEFAULT_USER_PREFERENCE, type UserPreference } from "@/lib/domain/user-preference";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

/**
 * Server-side preferences fetch shared by the standalone settings page and the
 * intercepted modal route, so both render identical data (D4).
 */
export async function loadUserPreferences(): Promise<UserPreference> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return DEFAULT_USER_PREFERENCE;
  }
  const service = createUserPreferenceService();
  return service.getOrDefault(session.user.id);
}
