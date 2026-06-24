# Data Model: Performance Audit & Vercel Telemetry

**Feature**: 039-perf-audit-vercel-analytics
**Date**: 2026-06-24

> Esta feature **não introduz entidades de banco de dados** (sem tabela, migração, repository ou service). Os "dados" são: (1) a entrada do helper de gating, (2) eventos agregados externamente nos painéis da Vercel, e (3) o artefato de relatório de diagnóstico. Modelados abaixo como contratos de dados, não como schema.

---

## 1. `TelemetryEnvironment` (entrada do helper de gating)

Objeto puro passado a `isTelemetryEnabled(env)` — **não** lido de `process.env` dentro da função (testabilidade).

| Campo | Tipo | Origem | Notas |
|---|---|---|---|
| `vercelEnv` | `string \| undefined` | `process.env.VERCEL_ENV` | `"production"` \| `"preview"` \| `"development"` \| `undefined` (local) |
| `e2eTestMode` | `string \| undefined` | `process.env.E2E_TEST_MODE` | `"1"` quando rodando sob harness E2E |

**Regra de derivação (pura, determinística)**:

```
isTelemetryEnabled(env) === (env.vercelEnv === "production") && (env.e2eTestMode !== "1")
```

**Tabela-verdade** (base dos testes unitários):

| `vercelEnv` | `e2eTestMode` | resultado |
|---|---|---|
| `"production"` | `undefined` | `true` |
| `"production"` | `"1"` | `false` |
| `"preview"` | `undefined` | `false` |
| `"development"` | `undefined` | `false` |
| `undefined` | `undefined` | `false` |
| `undefined` | `"1"` | `false` |

Sem estado, sem mutação, sem I/O. Cobertura unitária: 100%.

---

## 2. `VERCEL_ENV` no schema de env

Adição ao `envSchema` (Zod) em `src/lib/env/schema.ts`:

| Campo | Regra Zod | Obrigatório |
|---|---|---|
| `VERCEL_ENV` | `z.enum(["production", "preview", "development"]).optional()` | Não — injetado pela Vercel; ausente em dev/test/E2E local |

Não participa de `superRefine` (não bloqueia build/produção). `E2E_TEST_MODE` permanece fora do schema (lido via `process.env` direto, runtime-only, como já é hoje).

---

## 3. Eventos agregados na Vercel (externos — fora do banco do app)

Estes "registros" vivem nos painéis da Vercel, não no PostgreSQL do app. Documentados para clareza de contrato.

### 3.1 Web Vital (Speed Insights)

| Campo | Descrição |
|---|---|
| `metric` | `LCP` \| `INP` \| `CLS` \| `FCP` \| `TTFB` |
| `value` | medição numérica |
| `route` | rota App Router atribuída automaticamente |
| `context` | dispositivo/conexão (anonimizado pela Vercel) |

### 3.2 Page View (Analytics)

| Campo | Descrição |
|---|---|
| `url` / `route` | rota visualizada (inclui transições client-side) |
| `referrer` | referência de navegação |
| — | **cookieless, sem PII**; respeita DNT |

Nenhum dos dois é persistido no app; nenhuma leitura de domínio depende deles.

---

## 4. Relatório de diagnóstico (artefato de documentação)

Snapshot datado imutável em `docs/diagnostics/<YYYY-MM>-baseline.md`.

| Seção | Conteúdo |
|---|---|
| **Metadados** | data, commit/branch, ambiente do run (`next start` local, build de produção), versões das ferramentas |
| **Lighthouse — scores** | por página (autenticação, dashboard, lista, detalhe, home pública, modal de configuração) × perfil (mobile, desktop) × 4 categorias (Performance, Acessibilidade, Boas Práticas, SEO) |
| **React Doctor — achados** | lista por categoria (segurança, performance, estado, efeitos, arquitetura, acessibilidade), cada item com severidade + recomendação |
| **Delta de instrumentação (SC-004)** | comparação pré vs. pós: first-load JS (gzipped), contribuição ao CLS, evidência de carregamento não-bloqueante |
| **Consolidação de a11y** | nota referenciando os testes `@axe-core/playwright` existentes (sem duplicar achados) |

Artefatos brutos (JSON/HTML do Lighthouse) ficam em `.lighthouse/` (gitignored), não versionados.
