# Research: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Date**: 2026-04-01 | **Branch**: `006-ui-polish-favorites`

## R1: Theming Strategy — CSS Variables com next-themes

**Decision**: Usar `next-themes` (já instalado) para gerenciar tema (claro/escuro/sistema) via classe CSS no `<html>`. Cores primárias implementadas como paletas de CSS variables que sobrescrevem `--primary` e derivados.

**Rationale**: `next-themes` já está no projeto e resolve SSR hydration mismatch nativamente. Usar CSS variables permite trocar a paleta primária sem re-render do React — apenas trocando um atributo `data-primary-color` no `<html>`.

**Alternatives considered**:
- Tailwind config com temas dinâmicos: rejeitado — requer rebuild, não funciona em runtime.
- React context com inline styles: rejeitado — viola Princípio IX (design tokens), pior performance.
- CSS-in-JS (styled-components): rejeitado — não alinhado com Tailwind-first do projeto.

## R2: Primary Color Palettes — Mapeamento OKLch

**Decision**: Definir 5 paletas de cor primária como blocos de CSS variables no `globals.css`, ativadas via atributo `data-primary-color` no `<html>`. Cada paleta sobrescreve `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary`, e `--sidebar-primary-foreground`.

**Paletas** (baseadas nos tokens do `design.pen`):

| ID | Nome | Hex (referência) | OKLch (light) | OKLch (dark) |
|----|------|-------------------|---------------|--------------|
| blue | Azul (padrão) | #2563EB | oklch(0.546 0.245 264) | oklch(0.623 0.214 259) |
| orange | Laranja | #F97316 | oklch(0.705 0.213 47) | oklch(0.744 0.183 55) |
| green | Verde | #10B981 | oklch(0.696 0.17 163) | oklch(0.735 0.149 164) |
| red | Vermelho | #EF4444 | oklch(0.627 0.257 29) | oklch(0.704 0.191 22) |
| amber | Âmbar | #D97706 | oklch(0.666 0.179 64) | oklch(0.728 0.160 70) |

**Rationale**: O projeto já usa OKLch no `globals.css`. Manter a mesma escala de cor garante consistência perceptual entre temas. Cada paleta precisa de variante light e dark para manter contraste acessível.

**Alternatives considered**:
- Hex direto: rejeitado — o projeto já está em OKLch; misturar modelos de cor causa inconsistência.
- Apenas 3 cores (blue/green/red): rejeitado — o design tem 5 tokens que o usuário pediu.

## R3: Font Size Scaling — CSS Custom Property

**Decision**: Usar uma custom property `--font-scale` no `<html>` que multiplica o `font-size` base. Valores: `small` = 14px, `medium` = 16px (padrão), `large` = 18px. Todos os tamanhos relativos (`rem`) escalam automaticamente.

**Rationale**: Alterar o `font-size` do `<html>` via CSS variable é a forma mais simples e cascadeante — todos os `rem` do Tailwind escalam proporcionalmente sem tocar em nenhum componente.

**Alternatives considered**:
- Tailwind `text-*` class overrides: rejeitado — requer alterar cada componente, frágil.
- CSS `zoom`: rejeitado — afeta layout além de texto, quebra breakpoints.

## R4: Sidebar Collapse State — Cookie (not localStorage)

**Decision**: Armazenar estado da sidebar (expanded/collapsed) em um cookie HTTP-only = false (client-readable) com `SameSite=Lax`. Lido no Server Component do layout para evitar flash.

**Rationale**: `localStorage` causa flash de layout no SSR (Server Component não tem acesso). Cookie é acessível tanto no servidor (via `cookies()` do Next.js) quanto no cliente. Não precisa ir para o banco porque é preferência de sessão local, não cross-device.

**Alternatives considered**:
- localStorage: rejeitado — causa flash de conteúdo no SSR.
- Banco de dados: rejeitado — overkill para estado de sessão local; adiciona latência.
- URL query param: rejeitado — poluição de URL, não persiste entre navegações.

## R5: Auto-save Architecture — Debounced PATCH

**Decision**: Cada seletor de preferência dispara um `PATCH /api/v1/user-preferences` com o campo alterado. Debounce de 300ms no cliente para evitar múltiplas chamadas em mudanças rápidas. Resposta: `200` com o objeto de preferência atualizado. Toast de confirmação no sucesso.

**Rationale**: Auto-save individual é mais responsivo que batch save. Debounce previne spam. PATCH parcial (apenas o campo alterado) é idempotente e eficiente.

**Alternatives considered**:
- PUT com objeto completo: rejeitado — sobrescreve tudo, risco de race condition entre tabs.
- WebSocket: rejeitado — YAGNI, complexidade injustificada para 4 campos.

## R6: Post-Login Redirect — Server-side redirect

**Decision**: Após login bem-sucedido, o `LoginForm` faz `authClient.signIn.username()`, e no callback de sucesso, chama uma API para obter a página favorita do usuário e faz `router.push(favoritePage)`. O `src/app/page.tsx` (rota `/`) faz redirect server-side via `redirect()` do Next.js baseado na sessão + preferência.

**Rationale**: Redirect server-side para `/` evita flash de conteúdo. Para pós-login (client-side flow), o redirect é feito pelo router após obter a preferência.

**Alternatives considered**:
- Middleware Next.js para redirect: rejeitado — middleware não tem acesso fácil ao DB; adiciona complexidade. Server Component com `redirect()` é suficiente.
- better-auth `callbackURL`: parcialmente usado — o callbackURL do better-auth pode ser dinâmico, mas requer que a preferência esteja disponível antes do login. Mais simples fazer o redirect no client após login.

## R7: Login Page Layout — Design Implementation

**Decision**: Reestruturar `src/app/(auth)/login/page.tsx` para layout de dois painéis flex. Painel esquerdo: fundo `sidebar-bg` com branding centralizado (logo headphones, título "AudioBook Track", subtítulo). Painel direito: fundo `bg-page` com card de formulário centralizado (`bg-surface`, sombra, border-radius 16px). Em mobile (< `md`), esconder painel esquerdo com `hidden md:flex`.

**Rationale**: Segue exatamente o design (frame "01 - Login" do `design.pen`). Mobile first: formulário sozinho em mobile, dois painéis a partir de `md`.

## R8: Settings Page Layout — Design Implementation

**Decision**: Nova rota `src/app/(authenticated)/settings/page.tsx`. Server Component que busca preferências do usuário. Layout: título "Configurações" + cards organizados por seção (Aparência: tema + fonte + cor primária; Navegação: página favorita). Cada card usa componente `Card` do shadcn/ui.

**Rationale**: Segue frame "05 - Configurações" do design. Cards separados por categoria melhoram a escaneabilidade e alinham com o design.