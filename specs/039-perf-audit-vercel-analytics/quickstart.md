# Quickstart: Performance Audit & Vercel Telemetry

**Feature**: 039-perf-audit-vercel-analytics

Guia rápido para implementar, verificar a telemetria e rodar o diagnóstico.

---

## Parte A — Telemetria (Speed Insights + Analytics)

### 1. Instalar dependências de produção

```bash
bun add @vercel/speed-insights @vercel/analytics
```

### 2. Helper de gating (TDD — teste primeiro)

`src/lib/telemetry/is-telemetry-enabled.ts`:

```ts
export interface TelemetryEnvironment {
  vercelEnv?: string;
  e2eTestMode?: string;
}

export function isTelemetryEnabled({ vercelEnv, e2eTestMode }: TelemetryEnvironment): boolean {
  return vercelEnv === "production" && e2eTestMode !== "1";
}
```

Teste unitário (`__tests__/unit/telemetry/is-telemetry-enabled.spec.ts`) cobre a tabela-verdade do [data-model.md](./data-model.md#1--telemetryenvironment-entrada-do-helper-de-gating).

### 3. Wrapper Server Component

`src/components/layout/vercel-telemetry.tsx` (sem `use client`):

```tsx
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { isTelemetryEnabled } from "@/lib/telemetry/is-telemetry-enabled";

export function VercelTelemetry() {
  const enabled = isTelemetryEnabled({
    vercelEnv: process.env.VERCEL_ENV,
    e2eTestMode: process.env.E2E_TEST_MODE,
  });

  if (!enabled) {
    return null;
  }

  return (
    <>
      <SpeedInsights />
      <Analytics />
    </>
  );
}
```

### 4. Montar no layout raiz

Em `src/app/layout.tsx`, dentro do `<body>`, após `{children}`:

```tsx
import { VercelTelemetry } from "@/components/layout/vercel-telemetry";
// ...
<body className="min-h-full flex flex-col">
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <NavigationProvider />
    {children}
  </ThemeProvider>
  <Toaster richColors position="top-right" />
  <VercelTelemetry />
</body>
```

### 5. Registrar `VERCEL_ENV` no schema de env

Em `src/lib/env/schema.ts`, adicionar ao objeto Zod:

```ts
VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
```

### 6. Verificar o gating (E2E)

`__tests__/e2e/telemetry-gating.spec.ts` — no run E2E (sem `VERCEL_ENV=production`), nenhuma requisição a `/_vercel/insights` ou `/_vercel/speed-insights` deve ocorrer e nenhum `<script>` da Vercel deve estar no DOM:

```ts
import { expect, test } from "./fixtures/app-server"; // não @playwright/test direto
import { login } from "./helpers/auth";

test("telemetry stays off in non-production", async ({ page }) => {
  const vercelRequests: string[] = [];
  page.on("request", (req) => {
    if (/\/_vercel\/(insights|speed-insights)/.test(req.url())) {
      vercelRequests.push(req.url());
    }
  });
  await login(page);
  await page.goto("/dashboard");
  expect(vercelRequests).toHaveLength(0);
});
```

### 7. Confirmar em produção (pós-deploy)

Após o deploy, navegar pelo app em produção e confirmar no painel da Vercel:
- **Speed Insights**: métricas de Web Vitals por rota aparecem (até ~24h — SC-001).
- **Analytics**: page views atribuídos às rotas, incluindo navegação client-side (SC-002).

---

## Parte B — Diagnóstico (baseline duplo)

### 1. Instalar dependências de diagnóstico (dev)

```bash
bun add -d lighthouse chrome-launcher
```

### 2. Adicionar scripts ao `package.json`

```jsonc
"diagnose:seed": "bun run scripts/diagnostics/seed.ts",
"diagnose:lighthouse": "bun run scripts/diagnostics/lighthouse.ts",
"diagnose:react": "bun run scripts/diagnostics/react-doctor.ts",
"diagnose": "bun run diagnose:seed && bun run diagnose:lighthouse && bun run diagnose:react"
```

O `diagnose:seed` insere ≥1 livro com capítulos (via `createTestBook`) e **exige que o admin exista** (rode `bun run db:seed` antes — o seed de diagnóstico não recria o admin). O Lighthouse loga em `localhost:3000` por padrão (override via `DIAGNOSE_BASE_URL`).

> ⚠️ **`next start` roda em modo produção**, onde o schema de env exige `SENTRY_DSN` + `CRON_SECRET` — salvo em build phase ou com `E2E_TEST_MODE=1`. Daí as variáveis abaixo. O `diagnose:lighthouse` usa o Chromium do **Playwright** com `--remote-debugging-port` (o Lighthouse anexa à porta); `chrome-launcher` fica disponível como fallback.

### 3. Capturar o baseline **PRÉ-instrumentação**

> Foto limpa: telemetria off. Como o gating já renderiza `null` fora de produção, uma build normal não embarca a telemetria. `E2E_TEST_MODE=1` no `start` satisfaz o env de runtime **e** mantém a telemetria off.

```bash
bun run build
E2E_TEST_MODE=1 bun run start &   # next start (produção) em :3000, telemetria off
bun run diagnose                   # seed + lighthouse (mobile+desktop, login admin) + react-doctor
```

`.lighthouse/` já está no `.gitignore`. Preserve os relatórios PRÉ antes do passo 4 (a build PÓS sobrescreve `.lighthouse/`).

### 4. Capturar o baseline **PÓS-instrumentação** (telemetria HABILITADA) e comparar

Repetir **com a telemetria ativa** — force `VERCEL_ENV=production` na build (senão o gating renderiza `null` e o delta sai 0). No `start`, forneça `SENTRY_DSN`/`CRON_SECRET` dummies **só no runtime** (não na build, para não embarcar o Sentry e poluir o delta):

```bash
VERCEL_ENV=production bun run build
VERCEL_ENV=production \
  SENTRY_DSN="https://0000000000000000000000000000abcd@o0.ingest.sentry.io/0" \
  CRON_SECRET="diagnostic-cron-secret-placeholder-0123456789ABCDEF" \
  bun run start &
bun run diagnose:lighthouse
```

Comparar com a PRÉ:
- **CLS delta** deve ser `0` (telemetria não renderiza DOM visível).
- **first-load JS delta** < 5 kb gzipped. O `next build` com **Turbopack não imprime a tabela de tamanhos** — meça o chunk de cliente da telemetria direto: `grep -rl "_vercel/insights" .next/static/chunks` e `gzip -c <chunk> | wc -c`.
- carregamento da telemetria **não-bloqueante** (script injetado client-side, async).
- ⚠️ Localmente, **Best Practices cai para ~96** (`errors-in-console`): os scripts `/_vercel/*` dão 404 sem a edge da Vercel. Volta a 100 em produção real.

### 5. Curar o relatório

Escrever `docs/diagnostics/2026-06-baseline.md` com a estrutura do [data-model.md §4](./data-model.md#4-relatório-de-diagnóstico-artefato-de-documentação): scores Lighthouse, achados do React Doctor (com severidade + recomendação), e a seção de delta de instrumentação. Não versionar artefatos brutos.

---

## Verificação final (antes do PR)

```bash
bun run lint            # zero erros/warnings
bun run test:unit       # inclui is-telemetry-enabled (100%)
bun run test:e2e        # inclui telemetry-gating
bun run build           # compila sem erros
```

**Checklist de aceitação** (mapeado à spec):
- [ ] `<SpeedInsights />` + `<Analytics />` montados no layout raiz (FR-001, FR-005)
- [ ] Telemetria OFF em dev/test/E2E/preview, ON só em produção (FR-003, FR-008, SC-003)
- [ ] Delta CLS = 0, JS < 5 kb gzipped, não-bloqueante (SC-004)
- [ ] Sentry intacto, `tracesSampleRate=0` (FR-009)
- [ ] Postura de privacidade documentada em `/docs` (FR-018)
- [ ] Relatório de baseline datado em `docs/diagnostics/` (FR-014, SC-005, SC-007)
- [ ] Suíte de qualidade verde (FR-016, SC-006)
