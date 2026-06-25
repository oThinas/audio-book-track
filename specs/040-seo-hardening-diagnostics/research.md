# Research: Hardening, SEO & tooling (D6 + D7 + D8)

Decisões técnicas para a Sessão 1. Fontes primárias consultadas via **Context7 MCP**
(better-auth, Lighthouse, Next.js) + leitura do código-fonte do audit do Lighthouse.

---

## D6 — Remover side effect em GET handler de sessão

### Decisão

Deletar o route handler GET `src/app/api/auth/clear-session/route.ts`. Mover a limpeza da
**sessão órfã** para o middleware `src/proxy.ts`:

1. O layout autenticado (`src/app/(authenticated)/layout.tsx`) troca
   `redirect("/api/auth/clear-session")` por `redirect("/login?reauth=1")`.
2. O `proxy()` ganha uma regra **antes** do bounce "cookie + /login → /dashboard": se
   `pathname === "/login"` e `searchParams.has("reauth")`, monta `NextResponse.next()`,
   **apaga os cookies de sessão do better-auth** (prefix-aware, `path: '/'`) na resposta e
   retorna — deixando `/login` renderizar e quebrando o loop de redirect.
3. O logout **interativo** continua via `authClient.signOut()` (better-auth `POST /sign-out`),
   inalterado.

### Rationale

- **A "opção (a)" do roadmap é inviável**: no Next 16, `cookies()` só pode ser **mutado** em
  Route Handler, Server Action ou middleware — nunca durante o render de um Server Component.
  É exatamente por isso que o código atual delega a um route handler GET. (Context7
  `/vercel/next.js`, file convention `proxy.mdx`/`next-response.mdx`.)
- **A "opção (b)" (Server Action/POST) não cobre o caso órfão**: o render do layout não pode
  invocar Server Action; e o logout interativo já usa `signOut` (o endpoint GET nunca foi o
  caminho interativo — só limpeza órfã + conveniência E2E).
- O **middleware** é o lugar idiomático para redirecionar + mutar cookie na resposta, e não é
  um "GET handler" → o react-doctor deixa de acusar "Side effect in GET handler" (FR-004).

### Forma correta de limpar o cookie (better-auth)

Context7 `/better-auth/better-auth` (concepts/cookies + `getSessionCookie`):

- `useSecureCookies` é **ligado por padrão em produção** → cookies ganham o prefixo
  `__Secure-`. O código atual apaga só `better-auth.session_token` (sem prefixo) → **falha em
  produção**; o loop órfão persiste em HTTPS. (Bug latente corrigido por esta feature.)
- Com `cookieCache.enabled: true` (config deste projeto), existem **dois** cookies de sessão:
  `session_token` **e** `session_data`. Ambos devem ser limpos.
- `getSessionCookie(request)` (usado no proxy) é **prefix-aware** (checa `__Secure-…` antes do
  nome simples), confirmando que a detecção do proxy já lida com produção.
- Não há helper público de delete para `NextResponse` (o `deleteSessionCookie` do better-auth
  é interno, baseado no `ctx` do endpoint).

**Implementação adotada (robusta, env-agnóstica):** apagar **todas as variantes** dos dois
cookies, com `path: '/'` explícito:

```
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];
for (const name of SESSION_COOKIE_NAMES) {
  response.cookies.delete({ name, path: "/" });
}
```

> **Gotcha (Context7 `next-response.mdx`):** `response.cookies.delete(name)` usa o `path` da
> request (`/login`), mas o cookie do better-auth é `path=/`. Sem `path: '/'` explícito o
> `Set-Cookie` de remoção **não casa** e o cookie sobrevive. Por isso usar a forma de objeto
> `{ name, path: '/' }`.

### Alternativas consideradas

- **(a) Limpar no Server Component** — inviável no Next 16 (ver acima).
- **(b) Converter para Server Action / `POST`** — não resolve o caso órfão (render não invoca
  Server Action) e o logout interativo já usa `signOut`; seria redundante.
- **Route handler POST/DELETE** — silenciaria o react-doctor, mas o layout (render) e o E2E
  (`page.goto` = GET) não alcançam POST; `signOut` falha em E2E (mismatch de origem). Quebra
  órfão + E2E.
- **Apagar só `session_token` sem prefixo** (status quo) — mantém o bug de produção.

---

## D7 — robots.txt válido (SEO = 100)

### Decisão

Criar `src/app/robots.ts` com `MetadataRoute.Robots` **permissivo**:

```
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
  };
}
```

Sem `sitemap` (o app não tem sitemap público). `src/proxy.ts` já isenta `robots.txt` do
matcher (rota pública garantida — FR-007).

### Rationale

- **`Disallow: /` é contraproducente.** O código-fonte do audit `is-crawlable` do Lighthouse
  (`core/audits/seo/is-crawlable.js`) reprova (score 0) quando o robots.txt bloqueia **todos**
  os bots: `if (parsedRobotsTxt && !parsedRobotsTxt.isAllowed(url, userAgent))`. Hoje o
  baseline tem `robots-txt` reprovado / `is-crawlable` aprovado (SEO 91). Com `Disallow: /`,
  apenas **trocaríamos** um fail por outro → SEO continuaria ~91. As metas "não indexar" e
  "SEO = 100" são **mutuamente exclusivas** no Lighthouse.
- Um robots.txt **permissivo válido** faz `robots-txt` **passar** sem reprovar `is-crawlable`
  → SEO = 100 (SC-001).
- A proteção de conteúdo é responsabilidade da **autenticação**: todo bot é redirecionado a
  `/login`; a única página realmente alcançável é a de login, cuja indexação é aceitável.

### Alternativas consideradas

- **`Disallow: /`** — semântico para app privado, mas reprova `is-crawlable` e não atinge
  SEO = 100 (rejeitado — contradiz o SC).
- **`robots.txt` via Route Handler manual** (`app/robots.txt/route.ts`) — Context7 mostra o
  padrão, mas o metadata route (`robots.ts`) é mais idiomático e tipado. Escolhido o metadata
  route.
- **Adicionar `metadata.robots = { index: false }` no layout** — reprovaria `is-crawlable`
  (mesmo efeito do noindex). Rejeitado.

---

## D8 — Cobertura Lighthouse do modal de configuração

### Decisão

Adicionar `puppeteer-core` como **devDependency** e, em `scripts/diagnostics/lighthouse.ts`,
após os audits de rota:

1. `connect` ao browser já aberto pelo Playwright via o mesmo CDP port
   (`DIAGNOSE_DEBUG_PORT`, default 9222): `puppeteer.connect({ browserURL })`.
2. Reaproveitar a sessão do admin setando os cookies já extraídos (`page.setCookie(...)`).
3. Navegar a uma rota autenticada (ex.: `/dashboard`), clicar no link da sidebar
   `[data-testid="sidebar"] a[href="/settings"]` (rótulo "Configurações") para disparar a rota
   interceptada `@modal/(.)settings` → o `SettingsModal` (Dialog) abre.
4. `const flow = await startFlow(page); await flow.snapshot();` e escrever o relatório
   (`flow.generateReport()` → HTML; `flow.createFlowResult()` → JSON) em `.lighthouse/`.
5. Remover o `console.warn` de skip (FR-011). Em falha (link/modal ausente), `try/catch` que
   loga e segue — sem abortar os demais audits (FR-012), como o skip de `/books/:id`.

### Rationale

- O modo **snapshot** do Lighthouse só é exposto pela **flow API** (`startFlow`), que exige um
  `page` do **Puppeteer** (Context7 `/googlechrome/lighthouse`, `docs/user-flows.md`). Não há
  equivalente Playwright — daí `puppeteer-core` (FR-009). Conecta-se ao mesmo CDP, então não
  baixa Chromium próprio nem conflita com o do Playwright.
- O modal é uma **rota interceptada** (navegação client-side): `goto('/settings')` renderiza a
  página standalone, não o modal. Por isso navega-se a uma rota autenticada e **clica-se** no
  link da sidebar para disparar o intercept.
- Snapshot roda só audits **estáticos** (A11y/best-practices/DOM), não métricas de navegação —
  coerente com "cobertura, não correção" (D8 não corrige achados nesta sessão).

### Alternativas consideradas

- **Lighthouse navigation mode em `/settings` standalone** — auditaria a página, não o modal
  interceptado (alvo do D8). Rejeitado.
- **`puppeteer` (full) em vez de `puppeteer-core`** — baixaria um Chromium próprio; conectamos
  ao CDP existente, então `puppeteer-core` basta e é mais leve. Escolhido `puppeteer-core`.

---

## Impacto em testes (consolidado)

- **Remover** `__tests__/unit/api/auth/clear-session.spec.ts` (rota deletada).
- **Reescrever** `__tests__/unit/proxy/proxy.spec.ts`: remover o teste que libera
  `/api/auth/clear-session`; adicionar — (a) `/login?reauth=1` com cookie apaga os cookies de
  sessão e renderiza `/login` (não redireciona p/ `/dashboard`); (b) cookie em `/login` **sem**
  `reauth` continua redirecionando p/ `/dashboard` (bounce preservado); (c) `?reauth=1` sem
  cookie apenas renderiza `/login`.
- **Novo** `__tests__/unit/app/robots.spec.ts`: a função `robots()` retorna
  `{ rules: { userAgent: '*', allow: '/' } }` (sem `disallow` bloqueante).
- **Atualizar** os helpers E2E (`auth/logout.spec.ts`, `settings-preferences.spec.ts`) de
  `page.goto("/api/auth/clear-session")` para `page.goto("/login?reauth=1")`.
- **D8 (script)** verificado por execução (`bun run diagnose:lighthouse`): gera o relatório do
  modal e não emite o warning de skip.

## Ordem de implementação

Quick-wins-first (independentes): **D7 → D8 → D6** (mais arriscado por último), embora as
prioridades das user stories sigam a severidade (D6 = P1).
