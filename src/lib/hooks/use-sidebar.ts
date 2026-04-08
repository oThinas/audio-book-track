"use client";

import { useCallback, useState } from "react";
import { SIDEBAR_COOKIE_NAME } from "./sidebar-constants";

export { getSidebarCollapsed, SIDEBAR_COOKIE_NAME } from "./sidebar-constants";

export function useSidebar(initialCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      const oneYear = 365 * 24 * 60 * 60 * 1000;

      if ("cookieStore" in window) {
        cookieStore.set({
          name: SIDEBAR_COOKIE_NAME,
          value: String(next),
          path: "/",
          expires: Date.now() + oneYear,
          sameSite: "lax",
        });
      }

      return next;
    });
  }, []);

  return { collapsed, toggle } as const;
}
