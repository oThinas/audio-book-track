"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import type { LoginInput } from "@/lib/schemas/auth";

const FAVORITE_PAGE_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  books: "/books",
  studios: "/studios",
  editors: "/editors",
  narrators: "/narrators",
  settings: "/settings",
};

export interface UseLoginFormReturn {
  readonly onSubmit: (values: LoginInput) => Promise<void>;
  readonly showPassword: boolean;
  readonly togglePassword: () => void;
}

export function useLoginForm(): UseLoginFormReturn {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  function togglePassword() {
    setShowPassword((prev) => !prev);
  }

  async function onSubmit(values: LoginInput) {
    const result = await authClient.signIn.username({
      username: values.username,
      password: values.password,
    });

    if (result.error) {
      toast.error("Credenciais inválidas. Verifique seu username e senha.");
      return;
    }

    try {
      const response = await fetch("/api/v1/user-preferences");
      if (response.ok) {
        const { data: prefs } = (await response.json()) as { data: { favoritePage?: string } };
        const redirectUrl = FAVORITE_PAGE_MAP[prefs?.favoritePage ?? ""] ?? "/dashboard";
        router.push(redirectUrl);
        return;
      }
    } catch {
      // Fallback to dashboard if preferences fetch fails
    }

    router.push("/dashboard");
  }

  return { onSubmit, showPassword, togglePassword };
}
