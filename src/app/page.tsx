import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { getPageUrl } from "@/lib/domain/navigable-pages";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  const service = createUserPreferenceService();
  const preferences = await service.getOrDefault(session.user.id);
  const url = getPageUrl(preferences.favoritePage);

  redirect(url);
}
