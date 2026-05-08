"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { registerNavigator, unregisterNavigator } from "./navigation-singleton";

export function NavigationProvider() {
  const router = useRouter();

  useEffect(() => {
    registerNavigator((path) => router.replace(path));
    return () => {
      unregisterNavigator();
    };
  }, [router]);

  return null;
}
