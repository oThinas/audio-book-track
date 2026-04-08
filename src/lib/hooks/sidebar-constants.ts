export const SIDEBAR_COOKIE_NAME = "sidebar-collapsed";

export function getSidebarCollapsed(cookieValue: string | undefined): boolean {
  return cookieValue === "true";
}
