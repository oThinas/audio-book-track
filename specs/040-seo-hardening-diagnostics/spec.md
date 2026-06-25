# Feature Specification: Hardening, SEO & tooling (D6 + D7 + D8)

**Feature Branch**: `040-seo-hardening-diagnostics`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Sessão 1 do roadmap de remediação 2026-06 (docs/diagnostics/2026-06-remediation-plan.md): Hardening, SEO & tooling agrupando D6 (side effect em GET handler de sessão), D7 (robots.txt válido para SEO) e D8 (cobertura Lighthouse do modal de configuração)."

## Overview

Rodada de "polimentos & ferramental" com três correções pequenas e de baixo risco
identificadas no diagnóstico da baseline 2026-06. As três são independentes entre si e
podem ser entregues isoladamente, mas compartilham a mesma ferramenta de verificação
(`bun run diagnose`):

- **D6 (Segurança):** o endpoint que limpa a sessão é um `GET` que muta estado (apaga
  cookie) e redireciona — viola a idempotência esperada de um GET e é sinalizado como
  erro de segurança pelo diagnóstico de saúde de código.
- **D7 (SEO):** não existe política de robots; o audit de SEO reprova a verificação
  `robots-txt` em todas as páginas. A correção é publicar um `robots.txt` **válido e
  permissivo** (sem `Disallow` bloqueante) — `Disallow: /` reprovaria o audit
  `is-crawlable` e **não** levaria o SEO a 100 (apenas trocaria um fail por outro). A
  indexação de conteúdo já é impedida pela autenticação (todo bot é redirecionado a
  `/login`).
- **D8 (Ferramental):** a execução de diagnóstico do Lighthouse pula o snapshot do modal
  de configuração interceptado, deixando uma superfície-chave fora da baseline.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remover efeito colateral do fluxo de limpeza de sessão (Priority: P1)

A postura de segurança do produto exige que requisições GET sejam idempotentes e livres
de efeitos colaterais. Hoje o encerramento/limpeza de sessão depende de um endpoint GET
que apaga o cookie de sessão e redireciona — comportamento sinalizado como erro de
segurança. O objetivo é eliminar esse efeito colateral mantendo dois fluxos intactos:
(1) o logout interativo do usuário e (2) a limpeza automática de uma sessão órfã quando
uma área autenticada detecta que não há sessão válida.

**Why this priority**: É o achado de maior severidade da sessão (🟡) e o único que toca
autenticação — uma preocupação de correção/segurança. É também o de maior risco de
verificação (fluxo de auth), então merece a maior atenção. Independente das demais
histórias.

**Independent Test**: Pode ser testada isoladamente disparando o logout de um usuário
autenticado e confirmando que ele chega à tela de login sem conseguir acessar rotas
protegidas, e re-rodando o diagnóstico de saúde de código para confirmar que o achado
"side effect in GET handler" desapareceu — sem depender de D7 ou D8.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado, **When** ele aciona o logout, **Then** a sessão é
   encerrada, ele é levado à tela de login e rotas protegidas passam a redirecionar para
   login até nova autenticação.
2. **Given** uma requisição chega a uma área autenticada com sessão ausente ou inválida
   (cookie órfão), **When** a verificação de sessão server-side falha, **Then** o cookie
   de sessão obsoleto é limpo e o visitante é redirecionado para a tela de login, **sem**
   passar por um endpoint GET que muta estado.
3. **Given** o diagnóstico de saúde de código é executado, **When** ele varre os handlers
   de requisição, **Then** nenhum achado "Side effect in GET handler" é reportado para o
   tratamento de sessão.
4. **Given** a suíte E2E de logout, **When** ela roda no fluxo novo, **Then** todos os
   testes passam (ajustados ao novo mecanismo de entrada, se o método de invocação mudar).

---

### User Story 2 - Política de robots válida para SEO (Priority: P2)

O produto é uma aplicação privada e inteiramente autenticada. Ele deve publicar uma
política de robots **válida e permissiva**, satisfazendo a verificação de SEO do audit
(que hoje reprova por ausência da política) **sem** reprovar `is-crawlable`. Um
`Disallow: /` seria semanticamente atraente para um app privado, mas reprovaria
`is-crawlable` e manteria o SEO em ~91 — por isso a política é permissiva; a proteção do
conteúdo cabe à autenticação (todo bot é redirecionado a `/login`).

**Why this priority**: Ganho mensurável claro (SEO = 100) e risco praticamente nulo —
adiciona apenas um recurso de metadados público, sem tocar lógica de negócio ou auth.
Independente das demais histórias.

**Independent Test**: Pode ser testada isoladamente requisitando a política de robots sem
autenticação e confirmando que ela retorna uma diretiva válida de "não indexar"; e
re-rodando o audit de SEO para confirmar score 100 nas páginas auditadas — sem depender de
D6 ou D8.

**Acceptance Scenarios**:

1. **Given** um mecanismo de busca (ou qualquer cliente não autenticado), **When** ele
   requisita a política de robots, **Then** recebe uma diretiva de robots **válida** que
   não bloqueia as rotas auditadas (sem `Disallow` que reprove `is-crawlable`).
2. **Given** o audit automatizado de SEO roda em qualquer página auditada, **When** ele
   avalia a verificação de robots, **Then** a verificação passa e o score de SEO é 100.
3. **Given** o app está protegido por verificação de sessão, **When** a política de robots
   é requisitada sem sessão, **Then** ela continua acessível publicamente (não é
   redirecionada para login).

---

### User Story 3 - Diagnóstico cobre o modal de configuração (Priority: P3)

A equipe que mantém a baseline de diagnóstico precisa que a execução do Lighthouse capture
o modal de configuração interceptado, hoje pulado por exigir um modo de captura não
suportado pelo ferramental atual. Sem isso, uma superfície-chave do app fica fora da
baseline e suas métricas não são medidas.

**Why this priority**: Completude de ferramental interno. Valor externo menor que D6/D7 e
risco baixo (afeta apenas scripts de diagnóstico, não o produto). Independente das demais
histórias.

**Independent Test**: Pode ser testada isoladamente executando a rotina de diagnóstico do
Lighthouse contra o app autenticado e confirmando que um relatório do modal de configuração
é gerado e que o aviso de "snapshot pulado" não aparece mais — sem depender de D6 ou D7.

**Acceptance Scenarios**:

1. **Given** a execução de diagnóstico do Lighthouse roda contra o app autenticado, **When**
   ela chega à etapa do modal de configuração, **Then** ela abre o modal pela mesma
   navegação que um usuário usaria (a entrada "Configurações" da barra lateral) e captura
   um relatório de snapshot.
2. **Given** a execução termina, **When** se revisa a saída do console, **Then** o aviso
   anterior de "settings-modal snapshot skipped" não é mais emitido.
3. **Given** o modal não pôde ser aberto por algum motivo, **When** a etapa falha, **Then**
   a execução reporta a falha de forma clara e segue com os demais audits sem abortar a
   rotina inteira.

---

### Edge Cases

- **Logout idempotente (D6):** acionar o logout quando o usuário já está deslogado deve
  ainda terminar na tela de login, sem erro.
- **Cookie de sessão órfão (D6):** cookie presente mas inválido server-side deve ser limpo
  na borda de entrada da área autenticada, evitando loop de redirect.
- **Robots acessível sem sessão (D7):** a política de robots não pode ser capturada pela
  verificação de sessão; precisa permanecer pública.
- **Modal indisponível na captura (D8):** se a entrada da barra lateral não for encontrada
  ou o modal não abrir, a rotina degrada graciosamente (reporta e continua), seguindo o
  padrão já existente para a descoberta de `/books/:id`.
- **SEO vs indexação (D7):** `Disallow: /` reprovaria o audit `is-crawlable` do Lighthouse,
  mantendo o SEO em ~91 (troca um fail por outro); por isso a política de robots é
  permissiva (ver Assumptions).
- **Cookie `__Secure-` em produção (D6):** a limpeza deve cobrir a variante prefixada
  `__Secure-` (e o `session_data` do cookie cache), senão o loop de redirect da sessão
  órfã persiste em HTTPS/produção.
- **Sem regressão de baseline (todas):** as correções não podem piorar os demais scores
  (Performance, Acessibilidade, Best Practices) das páginas já auditadas.

## Requirements *(mandatory)*

### Functional Requirements

#### D6 — Efeito colateral em GET handler de sessão

- **FR-001**: O sistema NÃO DEVE limpar estado de sessão nem executar redirecionamentos
  como efeito colateral de um handler de requisição GET.
- **FR-002**: Quando uma área autenticada detectar sessão ausente ou inválida, o sistema
  DEVE limpar **todos os cookies de sessão relevantes do better-auth** (`session_token` e
  `session_data`, incluindo a variante `__Secure-` usada em produção) e redirecionar o
  visitante para a tela de login — quebrando o loop de redirect também em HTTPS/produção.
- **FR-003**: A ação interativa de logout DEVE encerrar a sessão do usuário e levá-lo à
  tela de login, após o que rotas protegidas ficam inacessíveis até nova autenticação.
- **FR-004**: O diagnóstico automatizado de saúde de código NÃO DEVE reportar achado de
  "side effect in GET handler" para o tratamento de sessão.
- **FR-005**: A cobertura E2E existente de logout DEVE continuar passando, adaptada ao novo
  fluxo caso o mecanismo de entrada mude.

#### D7 — Política de robots para SEO

- **FR-006**: O sistema DEVE publicar uma política de robots **válida e permissiva** (sem
  `Disallow` que bloqueie as rotas auditadas), satisfazendo o audit `robots-txt` **sem**
  reprovar `is-crawlable`. A proteção do conteúdo é responsabilidade da autenticação, não
  do robots.txt.
- **FR-007**: O recurso de política de robots DEVE ser acessível publicamente, sem exigir
  autenticação.
- **FR-008**: O audit automatizado de SEO DEVE reportar a verificação de robots como
  aprovada e um score de SEO de 100 em todas as páginas auditadas.

#### D8 — Cobertura do modal de configuração no diagnóstico

- **FR-009**: A execução de diagnóstico do Lighthouse DEVE capturar um relatório de
  auditoria do modal de configuração interceptado como uma das superfícies-chave.
- **FR-010**: A execução DEVE abrir o modal de configuração pela mesma navegação que um
  usuário usaria (a entrada "Configurações" da barra lateral), dentro da sessão já
  autenticada.
- **FR-011**: A execução NÃO DEVE mais emitir o aviso de "settings-modal snapshot skipped"
  após a captura ser implementada.
- **FR-012**: Se o modal não puder ser aberto, a execução DEVE reportar a falha claramente
  sem abortar os demais audits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O score de SEO do audit Lighthouse é **100** em todas as páginas auditadas
  (login, dashboard, books, books-detail), em perfil mobile e desktop.
- **SC-002**: O diagnóstico de saúde de código (`react-doctor --verbose`) reporta **zero**
  achados de "Side effect in GET handler".
- **SC-003**: A jornada E2E de logout passa de ponta a ponta: um usuário autenticado
  consegue sair, chega à tela de login, e rotas protegidas redirecionam para login.
- **SC-004**: Uma execução de `bun run diagnose:lighthouse` produz um relatório de snapshot
  do modal de configuração e **não** emite aviso de skip para ele.
- **SC-005**: Re-rodar o diagnóstico completo (`bun run diagnose`) mostra os três achados
  (D6, D7, D8) resolvidos **sem regressão** dos demais scores da baseline.

## Assumptions

- O produto é intencionalmente privado e inteiramente autenticado; a proteção de conteúdo
  é feita pela autenticação, não pelo robots.txt. Optou-se por **SEO = 100** (robots.txt
  permissivo) em vez de `Disallow: /`, que reprovaria `is-crawlable` e não melhoraria o
  score. A única página realmente alcançável por crawlers é `/login`, cuja indexação é
  aceitável.
- O botão de logout interativo já usa o sign-out do cliente de autenticação (não o endpoint
  GET); o endpoint GET existe hoje apenas para limpeza de sessão órfã no layout autenticado
  e como conveniência para testes E2E.
- **D6 resolvido no grill:** a opção (a) do roadmap (limpar cookie no Server Component) é
  **inviável** no Next 16 — cookies só são mutáveis em Route Handler, Server Action ou
  middleware (é por isso que o código atual redireciona para um route handler). A direção
  adotada é **limpar no middleware**: deletar o route handler GET `clear-session`; o layout
  autenticado redireciona a `/login?reauth=1` (sinal) e o middleware apaga os cookies de
  sessão na resposta, permitindo `/login` renderizar (sem o bounce para `/dashboard`). O
  logout interativo (better-auth `signOut`) permanece inalterado. O nome do parâmetro e a
  API para derivar nomes de cookie (prefix-aware) são detalhados no `/speckit-plan`.
- O diagnóstico roda contra um build de produção com uma sessão de admin semeada, conforme
  o fluxo de diagnóstico já existente (`bun run build && bun run start` + `diagnose:seed`).
- O snapshot do modal (D8) exige a flow API do Lighthouse (Puppeteer); adicionar
  `puppeteer-core` como devDependency é aceitável e não afeta o bundle de produção. O
  snapshot cobre apenas o subconjunto de audits estáticos (A11y/best-practices/DOM), não
  métricas de navegação.
- **D8 é somente cobertura:** achados de score do modal não são corrigidos nesta sessão
  (viram itens de uma baseline futura).
- **Ordem de implementação:** quick-wins-first — **D7 → D8 → D6** (mais arriscado por
  último), embora as prioridades das user stories sigam a severidade (D6 = P1).
- Não há mudança de banco/schema nem de modelo de domínio nesta sessão.

## Impacto em testes (D6)

Deletar o route handler GET `clear-session` tem consequências de teste já mapeadas:

- **Remover** `__tests__/unit/api/auth/clear-session.spec.ts` (a rota deixa de existir).
- **Reescrever** `__tests__/unit/proxy/proxy.spec.ts`: remover o teste que libera
  `/api/auth/clear-session` sem auth e **adicionar** cobertura do novo comportamento do
  middleware — `/login?reauth=1` com cookie presente apaga os cookies e permite renderizar
  `/login`; cookie válido em `/login` **sem** o sinal continua redirecionando para
  `/dashboard` (bounce preservado).
- **Atualizar** os helpers E2E que hoje navegam para `/api/auth/clear-session`
  (`__tests__/e2e/auth/logout.spec.ts` e `__tests__/e2e/settings-preferences.spec.ts`)
  para o novo URL GET-safe de logout.

## Dependencies

- Scripts de diagnóstico existentes (`scripts/diagnostics/*`) e o driver do Lighthouse.
- Tratamento de sessão do cliente de autenticação e exclusões de rota pública do
  middleware/proxy (que já isenta `robots.txt` do matcher).

## Out of Scope

- Os demais itens do backlog da baseline 2026-06 (D1 acessibilidade, D2/D3 performance
  mobile, D4/D5 React Compiler/effects) — cobertos por sessões futuras (041–043).
- Os ~173 warnings de manutenibilidade do React Doctor não itemizados no backlog §6.
- A categoria experimental `agentic-browsing` do Lighthouse 13.
