"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api/api-fetch";
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
      toast.error("Credenciais inválidas. Verifique seu usuário e senha.");
      return;
    }

    const prefsResult = await apiFetch<{ data: { favoritePage?: string } }>(
      "/api/v1/user-preferences",
    );
    if (prefsResult.ok) {
      const favoritePage = prefsResult.data.data.favoritePage ?? "";
      const redirectUrl = FAVORITE_PAGE_MAP[favoritePage] ?? "/dashboard";
      router.push(redirectUrl);
      return;
    }

    router.push("/dashboard");
  }

  return { onSubmit, showPassword, togglePassword };
}
