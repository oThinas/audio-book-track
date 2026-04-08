import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PreferenceInitializer } from "@/components/features/settings/preference-initializer";
import { auth } from "@/lib/auth/server";
import { createUserPreferenceService } from "@/lib/factories/user-preference";
import { getSidebarCollapsed, SIDEBAR_COOKIE_NAME } from "@/lib/hooks/sidebar-constants";
import { AuthenticatedLayoutClient } from "./layout-client";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    const cookieStore = await cookies();
    cookieStore.delete("better-auth.session_token");
    redirect("/login");
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const initialCollapsed = getSidebarCollapsed(sidebarCookie);

  const service = createUserPreferenceService();
  const preferences = await service.getOrDefault(session.user.id);

  return (
    <AuthenticatedLayoutClient initialCollapsed={initialCollapsed}>
      <PreferenceInitializer
        fontSize={preferences.fontSize}
        primaryColor={preferences.primaryColor}
      />
      {children}
    </AuthenticatedLayoutClient>
  );
}
