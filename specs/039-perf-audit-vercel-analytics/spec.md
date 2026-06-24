# Feature Specification: Performance Audit & Vercel Telemetry

**Feature Branch**: `039-perf-audit-vercel-analytics`

**Created**: 2026-06-24

**Status**: Draft

**Input**: User description: "Executar diagnóstico do Lighthouse e React Doctor. Adicionar vercel speed insights e vercel analytics;"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
-->

### User Story 1 - Telemetria de Web Vitals reais em produção (Priority: P1)

Como responsável pelo produto, quero que o app colete automaticamente as métricas de Core Web Vitals (LCP, INP, CLS, FCP, TTFB) de usuários reais em produção, para acompanhar continuamente a performance percebida e detectar regressões logo após cada deploy — sem depender apenas de medições sintéticas em laboratório.

**Why this priority**: O projeto trata performance como obsessão (orçamentos de bundle e metas de Core Web Vitals já definidos). Medição contínua de usuários reais (RUM) é o ganho duradouro que sustenta todas as decisões futuras de performance e fecha o ciclo de observabilidade já iniciado na produção. Entrega valor sozinha, independentemente das demais histórias.

**Independent Test**: Implantar a telemetria, navegar por páginas em produção e confirmar que as métricas de Web Vitals aparecem no painel de Speed Insights dentro do intervalo esperado de coleta, atribuídas às rotas corretas.

**Acceptance Scenarios**:

1. **Given** o app implantado em produção (`VERCEL_ENV === "production"`), **When** um usuário real navega por uma rota, **Then** as métricas de Web Vitals dessa visualização são coletadas e ficam visíveis no painel de Speed Insights atribuídas àquela rota.
2. **Given** o app rodando em desenvolvimento, teste, E2E ou em um **preview deploy** da Vercel, **When** páginas são carregadas, **Then** nenhuma métrica é enviada (a telemetria não polui os dados de produção nem interfere nos testes).
3. **Given** a telemetria habilitada, **When** uma página carrega, **Then** a coleta não introduz deslocamento de layout (contribuição nula ao CLS) nem viola o orçamento de bundle definido para o app.

---

### User Story 2 - Analytics de uso e navegação (Priority: P2)

Como responsável pelo produto, quero registrar visualizações de página e os fluxos de navegação dos usuários, para entender quais telas são mais utilizadas e onde os usuários concentram o tempo, embasando priorização de produto.

**Why this priority**: Complementa a telemetria de performance com sinal de comportamento (quais rotas importam mais), mas o app entrega valor mesmo sem ele. Depende da mesma decisão de instrumentação e gating da P1, então é natural sequenciá-lo logo em seguida.

**Independent Test**: Implantar o analytics, navegar pelas rotas públicas e autenticadas e confirmar que cada visualização de página gera um evento atribuído à rota correta no painel de Analytics, respeitando privacidade (sem coleta de PII, sem cookies).

**Acceptance Scenarios**:

1. **Given** o analytics habilitado em produção, **When** o usuário navega entre rotas (incluindo navegação client-side do App Router, sem recarregar a página), **Then** cada visualização de página é registrada e atribuída à rota correta no painel de Analytics.
2. **Given** um usuário com sinal de privacidade ativo (ex.: Do Not Track) ou um ambiente não-produção/preview, **When** ele navega pelo app, **Then** nenhum dado pessoal identificável é coletado e nenhum evento é gerado fora de produção.

---

### User Story 3 - Diagnóstico de baseline de performance e qualidade (Priority: P3)

Como desenvolvedor, quero um relatório de baseline gerado pelo Lighthouse (performance, acessibilidade, boas práticas, SEO) e pelo React Doctor (scanner estático de qualidade React) sobre as páginas-chave do app, para identificar e priorizar os principais problemas antes de investir em correções.

**Why this priority**: É uma atividade pontual de avaliação que informa trabalho futuro. Tem valor independente (produz um relatório acionável) mas não altera o comportamento do app em produção, por isso fica após a instrumentação contínua. Sua execução, porém, deve cercar a instrumentação (baseline antes e depois — ver Assumptions).

**Independent Test**: Executar Lighthouse e React Doctor sobre as páginas-chave e produzir um relatório versionado contendo scores por categoria e uma lista priorizada de problemas com recomendações.

**Acceptance Scenarios**:

1. **Given** o app em build de produção rodando localmente (`next start`) com sessão autenticada, **When** o diagnóstico é executado sobre as páginas-chave, **Then** é produzido um relatório com os scores de cada categoria do Lighthouse e os problemas detectados pelo React Doctor.
2. **Given** o relatório gerado, **When** ele é revisado, **Then** cada problema relevante aparece classificado por severidade/impacto com uma recomendação acionável, permitindo decidir o que tratar em features futuras.

---

### Edge Cases

- **Ambientes não-produção e preview**: telemetria e analytics NÃO devem disparar em desenvolvimento, teste, execuções E2E (Playwright) nem em **preview deploys** da Vercel — apenas em produção real.
- **Privacidade / LGPD**: o analytics não coleta dados pessoais identificáveis nem usa cookies que exijam consentimento; sinais de privacidade do usuário (ex.: Do Not Track) são respeitados — sem necessidade de banner de consentimento.
- **Bloqueio de scripts**: quando o coletor de telemetria é bloqueado (ad-blocker, falha de rede), o app continua funcionando normalmente, sem erros visíveis ao usuário.
- **Navegação client-side**: as visualizações de página são contabilizadas em transições de rota do App Router (sem recarregamento completo), não apenas no primeiro carregamento.
- **Rotas autenticadas no diagnóstico**: o Lighthouse precisa de uma sessão válida para auditar rotas protegidas; o diagnóstico cobre tanto rotas públicas quanto autenticadas.
- **Modal de configuração (intercepting route)**: auditar o modal não equivale a abrir a URL `/settings` (que renderiza a página cheia, o fallback). O estado de modal só aparece em navegação soft client-side; deve ser auditado dirigindo a navegação via Playwright em modo snapshot/timespan.
- **Impacto em performance**: a própria instrumentação não pode degradar as métricas que se propõe a medir (peso de JS, layout shift) — verificado pelo baseline duplo (antes/depois).

## Requirements *(mandatory)*

### Functional Requirements

#### Telemetria de performance (US1)

- **FR-001**: O app MUST coletar as métricas de Core Web Vitals (LCP, INP, CLS, FCP, TTFB) de usuários reais quando em produção e disponibilizá-las em painel de monitoramento contínuo (Vercel Speed Insights).
- **FR-002**: A telemetria de performance MUST atribuir cada métrica à rota correspondente, permitindo análise por página.
- **FR-003**: A coleta de telemetria MUST estar habilitada **somente** quando o app roda em produção real — critério canônico: `VERCEL_ENV === "production"` **e** `E2E_TEST_MODE !== "1"`. Em desenvolvimento, teste, E2E e **preview deploys**, a coleta MUST permanecer desabilitada sem necessidade de remover o código.
- **FR-004**: A instrumentação de telemetria MUST NOT introduzir deslocamento de layout (contribuição nula ao CLS) nem violar o orçamento de bundle de JS do app (ver SC-004).

#### Analytics de uso (US2)

- **FR-005**: O app MUST registrar visualizações de página em produção, incluindo transições de rota client-side do App Router (sem recarregamento completo).
- **FR-006**: O analytics MUST atribuir cada visualização à rota correta e cobrir tanto rotas públicas quanto autenticadas.
- **FR-007**: O analytics MUST operar de forma compatível com privacidade: cookieless, sem coleta de dados pessoais identificáveis e respeitando sinais de privacidade do usuário (ex.: Do Not Track). NÃO é necessário banner de consentimento.
- **FR-008**: O analytics MUST estar desabilitado fora de produção pelo mesmo critério canônico da FR-003 (inclui preview deploys).

#### Centralização de observabilidade (transversal)

- **FR-009**: Toda métrica de performance e de uso MUST ser centralizada na Vercel (Speed Insights para Web Vitals, Analytics para page views). O Sentry MUST permanecer dedicado apenas a erros/exceções, com `tracesSampleRate=0` inalterado — sem instrumentação duplicada de Web Vitals.

#### Diagnóstico de baseline (US3)

- **FR-010**: O diagnóstico MUST executar uma auditoria Lighthouse sobre as páginas-chave (no mínimo: autenticação, dashboard, lista de livros, detalhe de livro/capítulos, home pública e o modal de configuração), nos perfis **mobile e desktop**, em **tema único**, produzindo scores das categorias Performance, Acessibilidade, Boas Práticas e SEO.
- **FR-011**: O diagnóstico MUST executar o React Doctor (scanner estático CLI, via `bunx react-doctor@latest`) e listar os problemas detectados nas categorias de segurança, performance, gestão de estado, efeitos React, arquitetura e acessibilidade.
- **FR-012**: O Lighthouse MUST rodar contra um **build de produção local (`next start`)** para gerar deltas reprodutíveis, obtendo sessão para rotas autenticadas reaproveitando o fluxo de login já usado nos testes E2E (Playwright). Os números de campo (mundo real) vêm do Speed Insights (US1), não desta execução de laboratório.
- **FR-013**: O diagnóstico MUST ser capturado como **baseline duplo**: uma vez **antes** de adicionar a instrumentação (foto limpa do app) e uma vez **depois** (para comprovar o delta da SC-004).
- **FR-014**: O diagnóstico MUST produzir um relatório **snapshot datado e imutável** em `/docs` (ex.: `docs/diagnostics/2026-06-baseline.md`), contendo os scores e uma lista de problemas classificados por severidade/impacto com recomendações acionáveis. O relatório consolida (não triplica) os achados de acessibilidade já cobertos por Lighthouse, React Doctor e pelos testes `@axe-core/playwright` existentes. Apenas o resumo curado é versionado; artefatos brutos (JSON/HTML do Lighthouse, saída crua do React Doctor) NÃO são versionados.
- **FR-018**: O projeto MUST registrar a **postura de privacidade** num doc em `/docs`: o que é coletado (Web Vitals, page views), que a coleta é cookieless e sem PII, e que sinais como Do Not Track são respeitados — justificando a ausência de banner de consentimento (FR-007).
- **FR-015**: O projeto MUST fornecer scripts de conveniência no `package.json` que regenerem as execuções de diagnóstico (Lighthouse-via-Playwright e React Doctor), de modo que qualquer pessoa reproduza um novo snapshot.

#### Transversais

- **FR-016**: A introdução da instrumentação MUST manter a suíte de verificação de qualidade do projeto verde (lint sem erros/warnings, testes e build de produção passando).
- **FR-017**: Os componentes de instrumentação MUST permanecer invisíveis ao usuário (sem elementos de UI visíveis), montados uma única vez no layout raiz (cobrindo rotas públicas e autenticadas), e MUST funcionar igualmente em modo claro e escuro sem afetar o layout existente.

### Key Entities *(include if feature involves data)*

- **Métrica de Web Vital**: medição de performance de uma visualização real (tipo da métrica, valor, rota associada, contexto de dispositivo/conexão), agregada no painel da Vercel — não persistida no banco do app.
- **Evento de visualização de página**: registro de que uma rota foi visualizada (rota, referência de navegação), agregado no painel da Vercel — sem PII, cookieless e não persistido no banco do app.
- **Relatório de diagnóstico**: artefato de documentação (snapshot datado, versionado em `/docs`) contendo scores por categoria, lista de problemas priorizados e recomendações; é a entrega da US3.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em até 24 horas após o deploy em produção, o painel de Speed Insights apresenta métricas de Web Vitals atribuídas às principais rotas do app, refletindo tráfego real.
- **SC-002**: 100% das rotas navegadas em produção (incluindo transições client-side) geram um evento de visualização de página atribuído à rota correta no painel de Analytics.
- **SC-003**: Nenhum evento de telemetria ou analytics é gerado em desenvolvimento, teste, E2E ou preview deploys (zero poluição de dados e zero impacto nos testes).
- **SC-004**: Comparando o baseline pré-instrumentação com o pós-instrumentação **medido com a telemetria habilitada** (o gating local renderiza `null`, então o delta de bundle só é observável numa build com a telemetria ativa — ex.: `VERCEL_ENV=production` local): a contribuição da telemetria ao **CLS é exatamente 0** (delta 0,000); o **delta combinado de first-load JS é < 5 kb gzipped** nas rotas afetadas e o total permanece **dentro do orçamento de app (< 300 kb gzipped por página)**; os scripts de telemetria carregam de forma **não-bloqueante** (sem entrar no caminho crítico de render).
- **SC-005**: O relatório de baseline cobre as 6 páginas-chave (≥ 4 exigidas) com scores nas 4 categorias do Lighthouse (mobile + desktop) e lista os problemas do React Doctor nas suas 6 categorias, cada um com severidade e recomendação.
- **SC-006**: A suíte de verificação de qualidade (lint, testes, build de produção) permanece verde após a feature.
- **SC-007**: O relatório de diagnóstico existe como snapshot datado e imutável em `/docs` e é regenerável pelos scripts de conveniência versionados.

## Assumptions

- O app é implantado na Vercel (já há configuração de deploy, crons e observabilidade em produção), portanto os painéis de Speed Insights e Analytics estão disponíveis e são os destinos da telemetria.
- **Sinal canônico de produção**: `VERCEL_ENV === "production"` (ausente no `next dev` e no `next start` local do E2E) combinado com o kill-switch `E2E_TEST_MODE !== "1"`. Preview deploys (`VERCEL_ENV === "preview"`) NÃO coletam.
- **React Doctor** é um scanner CLI estático determinístico (`react-doctor@latest`) que complementa o lint; como o projeto usa Biome (não ESLint/oxlint), o recurso de leitura de config de lint não se aplica — ele roda standalone. O React Compiler (`reactCompiler: true`) não sobrepõe nenhuma das categorias do React Doctor.
- **Divisão de observabilidade**: Sentry = só erros/exceções (alertas de 500), `tracesSampleRate=0` mantido; Vercel = todas as demais métricas (Web Vitals + page views). Sem RUM duplicado.
- **Sequenciamento**: embora US3 seja P3 em valor, o baseline do Lighthouse é capturado **antes** de instrumentar (foto limpa) e **depois** (comprovar SC-004). Prioridade ≠ ordem de execução.
- **Método de laboratório**: Lighthouse roda contra `next start` (build de produção) local para deltas reprodutíveis; rotas autenticadas usam a sessão do fluxo de login do E2E (Playwright); o modal de configuração é auditado por navegação soft (modo snapshot/timespan).
- A detecção de ambiente reutiliza os mecanismos já existentes no projeto (`VERCEL_ENV`, `E2E_TEST_MODE`).
- A coleta de métricas/eventos é agregada nos painéis da Vercel; não há nova tabela, migração de schema, repository ou service de domínio nesta feature.
- O diagnóstico é executado sob demanda pelo time (atividade pontual), não como gate automático de CI nesta primeira entrega.

## Out of Scope

- Correção dos problemas de performance/acessibilidade/qualidade identificados pelo diagnóstico (serão priorizados em features subsequentes — a natureza das mudanças ainda é desconhecida).
- Integração do React Doctor como **GitHub Action** de scan em PR (e qualquer CI gate que reprove build por queda de score do Lighthouse).
- Banner/mecanismo de **consentimento de cookies** (a coleta é cookieless e anônima; consent management seria feature separada se exigido juridicamente).
- Ligar o tracing/RUM do **Sentry** ou qualquer instrumentação de Web Vitals fora da Vercel.
- Persistência própria de métricas no banco do app ou dashboards internos (a agregação fica nos painéis da Vercel).
- Coleta de eventos de produto customizados além de visualizações de página (eventos de conversão/funil ficam para depois, se necessário).
- Versionar artefatos brutos do Lighthouse/React Doctor (apenas o resumo curado é commitado).
