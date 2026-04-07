import { Headphones } from "lucide-react";
import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      <div
        data-testid="login-branding-panel"
        className="hidden bg-slate-800 md:flex md:w-1/2 flex-col items-center justify-center gap-3"
      >
        <div className="flex flex-col items-center gap-3">
          <Headphones data-testid="login-branding-icon" className="size-14 text-blue-500" />
          <h1 className="text-[28px] font-bold text-white">AudioBook Track</h1>
        </div>
        <p className="w-[360px] text-center text-base text-slate-400">
          Gerencie sua produção de audiolivros
          <br />
          com precisão e clareza
        </p>
      </div>

      <div
        data-testid="login-form-panel"
        className="flex w-full items-center justify-center bg-slate-50 px-4 md:w-1/2"
      >
        <div className="w-full max-w-[400px] rounded-2xl bg-white p-10 shadow-[0_4px_24px_rgba(30,41,59,0.09)]">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-800">Entrar</h2>
              <p className="mt-1 text-sm text-slate-500">Acesse sua conta para continuar</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
