import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { PreferenceInitializer } from "@/components/features/settings/preference-initializer";
import { getSidebarCollapsed, SIDEBAR_COOKIE_NAME } from "@/components/layout/sidebar-constants";
import { auth } from "@/lib/auth/server";
import { createUserPreferenceService } from "@/lib/factories/user-preference";
import { AuthenticatedLayoutClient } from "./layout-client";

export default async function AuthenticatedLayout({
  children,
  modal,
}: Readonly<{
  children: React.ReactNode;
  modal: React.ReactNode;
}>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login?reauth=1");
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;
  const initialCollapsed = getSidebarCollapsed(sidebarCookie);

  const service = createUserPreferenceService();
  const preferences = await service.getOrDefault(session.user.id);

  return (
    <>
      <AuthenticatedLayoutClient initialCollapsed={initialCollapsed}>
        <PreferenceInitializer
          fontSize={preferences.fontSize}
          primaryColor={preferences.primaryColor}
        />
        {children}
      </AuthenticatedLayoutClient>
      {/* Parallel @modal slot — intercepted routes (e.g. /settings) render here,
          outside the content view-transition boundary; the Dialog portals over
          the whole app. Empty (null) otherwise. */}
      {modal}
    </>
  );
}
