# UI Contract: Vercel Telemetry Mounting & Gating

**Feature**: 039-perf-audit-vercel-analytics

Esta feature não expõe API HTTP. O contrato é de **UI/composição** (montagem dos componentes) e de **comportamento de gating** (quando a telemetria liga).

---

## C1 — Helper de gating (`src/lib/telemetry/is-telemetry-enabled.ts`)

```ts
export interface TelemetryEnvironment {
  vercelEnv?: string;
  e2eTestMode?: string;
}

export function isTelemetryEnabled(env: TelemetryEnvironment): boolean;
```

**Contrato**:
- Retorna `true` **se e somente se** `env.vercelEnv === "production"` **e** `env.e2eTestMode !== "1"`.
- Função pura: sem I/O, sem leitura de `process.env`, sem efeitos colaterais, sem mutação do argumento.
- Determinística para a mesma entrada.

---

## C2 — Wrapper Server Component (`src/components/layout/vercel-telemetry.tsx`)

```tsx
// Server Component — SEM "use client"
export function VercelTelemetry(): React.ReactNode;
```

**Contrato**:
- Lê `process.env.VERCEL_ENV` e `process.env.E2E_TEST_MODE`, monta `TelemetryEnvironment` e delega a `isTelemetryEnabled`.
- Quando habilitado: renderiza `<SpeedInsights />` (`@vercel/speed-insights/next`) **e** `<Analytics />` (`@vercel/analytics/next`).
- Quando desabilitado: renderiza `null` — **nenhum** script da Vercel é incluído (peso zero no cliente).
- Não recebe props de domínio; não mantém estado; permanece Server Component.

---

## C3 — Montagem no layout raiz (`src/app/layout.tsx`)

**Contrato**:
- `<VercelTelemetry />` é renderizado dentro do `<body>`, após `{children}`, uma única vez (cobre rotas públicas e autenticadas — FR-017).
- Não altera a estrutura visual existente (ThemeProvider, Toaster, fontes permanecem).
- Layout raiz continua Server Component.

---

## C4 — Comportamento observável (base de testes)

| Cenário | Ambiente | Telemetria | Verificação |
|---|---|---|---|
| Produção real | `VERCEL_ENV=production`, sem `E2E_TEST_MODE` | **ON** | scripts/insights presentes (manual, pós-deploy) |
| Preview deploy | `VERCEL_ENV=preview` | **OFF** | unit: `isTelemetryEnabled` → false |
| Dev local | `VERCEL_ENV` ausente | **OFF** | unit: false |
| E2E / test | `E2E_TEST_MODE=1` (e/ou sem `VERCEL_ENV`) | **OFF** | **E2E**: nenhuma requisição a `/_vercel/insights` nem `/_vercel/speed-insights`; nenhum `<script>` da Vercel no DOM |

**Privacidade (FR-007)**: Analytics cookieless por padrão; nenhuma URL auditada carrega PII em query string. `beforeSend` permanece disponível como camada de redação futura, não usado nesta entrega.
