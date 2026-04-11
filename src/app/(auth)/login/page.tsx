import { Headphones } from "lucide-react";
import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <div
        data-testid="login-branding-panel"
        className="hidden bg-sidebar md:flex md:w-1/2 flex-col items-center justify-center gap-3"
      >
        <div className="flex flex-col items-center gap-3">
          <Headphones data-testid="login-branding-icon" className="size-14 text-primary" />
          <h1 className="text-[28px] font-bold text-sidebar-foreground">AudioBook Track</h1>
        </div>
        <p className="w-90 text-center text-base text-sidebar-foreground/70">
          Gerencie sua produção de audiolivros
          <br />
          com precisão e clareza
        </p>
      </div>

      <div
        data-testid="login-form-panel"
        className="flex w-full items-center justify-center bg-background px-4 md:w-1/2"
      >
        <div className="w-full max-w-100 rounded-2xl bg-card p-10 shadow-[0_4px_24px_rgba(30,41,59,0.09)]">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
              <p className="mt-1 text-sm text-muted-foreground">Acesse sua conta para continuar</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
