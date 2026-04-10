"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";
import { type LoginInput, loginSchema } from "@/lib/schemas/auth";

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  async function onSubmit(data: LoginInput) {
    setIsLoading(true);

    const result = await authClient.signIn.username({
      username: data.username,
      password: data.password,
    });

    if (result.error) {
      setIsLoading(false);
      toast.error("Credenciais inválidas. Verifique seu username e senha.");
      return;
    }

    try {
      const response = await fetch("/api/v1/user-preferences");
      if (response.ok) {
        const { data: prefs } = await response.json();
        const favoritePageMap: Record<string, string> = {
          dashboard: "/dashboard",
          books: "/books",
          studios: "/studios",
          editors: "/editors",
          narrators: "/narrators",
          settings: "/settings",
        };
        const redirectUrl = favoritePageMap[prefs?.favoritePage] ?? "/dashboard";
        router.push(redirectUrl);
        return;
      }
    } catch {
      // Fallback to dashboard if preferences fetch fails
    }

    router.push("/dashboard");
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username" className="text-[13px] font-medium text-foreground">
          Usuário
        </Label>
        <Input
          id="username"
          type="text"
          placeholder="username"
          autoComplete="username"
          disabled={isLoading}
          className="h-11 rounded-lg"
          {...register("username")}
        />
        {errors.username && <p className="text-sm text-destructive">{errors.username.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password" className="text-[13px] font-medium text-foreground">
          Senha
        </Label>
        <InputGroup className="h-11 rounded-lg">
          <InputGroupInput
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={isLoading}
            className="h-11"
            {...register("password")}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>

      <Button
        id="login-submit"
        type="submit"
        className="h-12 w-full rounded-lg text-[15px] font-semibold"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </Button>
    </form>
  );
}
