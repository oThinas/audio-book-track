"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export interface UseLogoutReturn {
  readonly handleLogout: () => Promise<void>;
  readonly isLoading: boolean;
}

export function useLogout(): UseLogoutReturn {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });

    setIsLoading(false);
  }

  return { handleLogout, isLoading };
}
