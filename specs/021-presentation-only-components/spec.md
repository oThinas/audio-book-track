# Feature Specification: Componentes Apenas de Renderização (Lógica em Hooks)

**Feature Branch**: `021-presentation-only-components`
**Created**: 2026-04-30
**Status**: Draft
**Input**: User description: "garanta que componentes tenham apenas renderização. A lógica deve ficar em hooks. Consultar /frontend-patterns e /frontend-design para detalhes;"

## Clarifications

### Session 2026-04-30

- Q: Qual feature será a implementação de referência em P1? → A: Estúdios
- Q: ESLint rule customizada para detectar lógica de domínio em componentes está no escopo? → A: Fora do escopo (enforcement via constituição + CLAUDE.md + self-review + code review)
- Q: Em que ordem as features remanescentes de P2 devem ser migradas? → A: Crescente em complexidade — configurações → autenticação → narradores → editores → livros & capítulos

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Estabelecer padrão de referência via feature de Estúdios (Priority: P1)

Como engenheiro do time, eu quero um **padrão arquitetural claro e um exemplo concreto já implementado na feature de Estúdios** que mostre como separar renderização (componentes `.tsx`) de lógica (hooks customizados), para que eu possa replicar a estrutura em qualquer feature nova ou existente sem ambiguidade.

**Why this priority**: Sem um padrão definido e um exemplo vivo no repositório, refatorações ficam inconsistentes e novas features continuam misturando renderização com lógica. Estabelecer o padrão primeiro é o pré-requisito para tudo que vem depois.

**Independent Test**: Ao abrir um componente refatorado, é possível ler o JSX em menos de 1 minuto e entender exatamente o que aparece na tela; ao abrir o hook correspondente, é possível entender o comportamento (fetch, mutação, validação, transições de estado) sem rodar a UI. Pareando engenheiro novo com a feature exemplo, ele reproduz o padrão em outra feature em até 1 hora sem revisão arquitetural.

**Acceptance Scenarios**:

1. **Given** o time concorda com o padrão "componentes só renderizam, hooks contêm lógica", **When** a feature **Estúdios** (`src/components/features/studios/`) é refatorada como implementação de referência, **Then** ela passa a ter hook(s) customizado(s) co-localizados (ex.: `use-studios.ts`, `use-studio-form.ts`, `use-delete-studio.ts`) contendo toda a lógica de estado/dados/mutações, e os componentes da feature (`studios-client.tsx`, `studios-table.tsx`, `studio-row.tsx`, `studio-new-row.tsx`, `delete-studio-dialog.tsx`) ficam reduzidos a JSX que consome o retorno desses hooks. Estúdios foi escolhida por concentrar CRUD completo + reativação por colisão de nome (soft-delete) — escopo recém-fechado e representativo do padrão sem o ruído de state machines de domínio.
2. **Given** o padrão de referência está pronto, **When** um engenheiro abre o componente refatorado, **Then** ele encontra apenas: importações, declaração da função, chamada do hook, retorno JSX. Nenhum `fetch`, nenhum `useState` de domínio, nenhum `useEffect` de sincronização, nenhuma mutação inline.
3. **Given** o padrão de referência está pronto, **When** o engenheiro abre o hook correspondente, **Then** encontra a lógica completa: estado, callbacks, derivações memoizadas, integração com a camada de dados — totalmente testável sem renderizar UI.

---

### User Story 2 - Migrar features existentes em ordem crescente de complexidade (Priority: P2)

Como mantenedor do projeto, eu quero **as features remanescentes refatoradas em ordem crescente de complexidade** — `configurações → autenticação → narradores → editores → livros & capítulos` — seguindo o padrão estabelecido em P1 (estúdios), para que toda a base de código fique consistente, o risco da migração seja distribuído (casos simples primeiro estabilizam convenções, caso mais complexo fica por último com padrão maduro), e a manutenção fique previsível.

**Why this priority**: Sem migrar o que já existe, o débito técnico cresce: novas features seguirão o padrão, mas leitores ainda precisam aprender dois estilos para navegar pelo código. Migrar entrega consistência e elimina a maior fonte de confusão para quem entra no time. A ordem crescente protege contra retrabalho — convenções dos hooks (naming, retorno, granularidade) são validadas em casos simples antes do mais complexo (capítulos com state machine + bulk delete + derived counts).

**Independent Test**: Após cada feature migrada, executar `bun run test:unit`, `bun run test:integration` e `bun run test:e2e` resulta em zero regressões. Para cada feature migrada, é possível abrir os componentes `.tsx` e ver apenas JSX + chamada de hook; abrir o hook correspondente e encontrar toda a lógica.

**Acceptance Scenarios**:

1. **Given** o padrão de referência de Estúdios (P1) está pronto, **When** as features remanescentes são migradas na ordem `configurações → autenticação → narradores → editores → livros & capítulos`, **Then** cada PR migra uma feature por vez, mantém a suíte de testes verde, e segue convenções já validadas (naming, retorno do hook, granularidade) — sem retrabalho dos hooks anteriores.
2. **Given** uma feature existente que mistura `useState` de domínio, `fetch`, `useEffect` de sincronização e mutações inline em um componente client, **When** a refatoração é aplicada, **Then** o estado/dados/efeitos saem para um hook customizado e o componente fica reduzido a renderização parametrizada.
3. **Given** todas as features migradas, **When** a suíte completa de testes é executada, **Then** os testes E2E e integration passam sem alteração e os hooks novos têm cobertura unitária ≥ 80%.
4. **Given** uma feature migrada, **When** um engenheiro precisa adicionar uma nova ação (ex.: novo campo em um formulário), **Then** ele altera o hook (lógica) **ou** o componente (apresentação) — nunca os dois ao mesmo tempo, exceto para conectar uma propriedade nova entre eles.

---

### User Story 3 - Garantir adesão para novas features via constituição + revisão (Priority: P3)

Como tech lead, eu quero **enforcement humano-assistido** — constituição amendada com princípio explícito, regra listada no CLAUDE.md, item dedicado no self-review checklist, e revisão de código (humana ou agente) — para que toda nova feature entre no padrão por construção, sem depender de detecção automática por linter.

**Why this priority**: Sem enforcement, o padrão decai. P3 protege o investimento de P1 e P2. Lint customizado fica explicitamente fora do escopo desta feature (ver Q2 em Clarifications) — pode entrar como follow-up dedicado se reincidência justificar.

**Independent Test**: Abrir um PR novo que viole intencionalmente o padrão (ex.: adicionar `fetch` direto em um componente client). O reviewer (humano ou agente) detecta a violação na primeira passada porque o self-review checklist sinaliza o item correspondente e a constituição/CLAUDE.md cita a regra com severidade clara.

**Acceptance Scenarios**:

1. **Given** o padrão ratificado, **When** a constituição (`.specify/memory/constitution.md`) é amendada, **Then** existe um princípio explícito declarando que componentes client são apenas renderização e lógica reside em hooks customizados, com critérios objetivos do que conta como "lógica".
2. **Given** o CLAUDE.md atualizado, **When** um engenheiro consulta as regras não-negociáveis, **Then** encontra a regra mencionada na seção de Arquitetura com exemplos do que é permitido vs. proibido.
3. **Given** o self-review checklist atualizado, **When** o engenheiro finaliza uma tarefa, **Then** existe um item dedicado: "Componentes client contêm apenas renderização? Lógica está em hooks customizados?".

---

### Edge Cases

- **Server Components**: a regra incide sobre **componentes client**. Server Components seguem o padrão atual (`async/await`, fetch direto na função do componente) e ficam fora do escopo.
- **Componentes UI primitivos (`src/components/ui/**`)**: já são puramente visuais por construção; não precisam de hook companheiro. Permanecem inalterados.
- **Estado puramente visual**: controles internos de Radix (`open`/`close` de um popover já gerenciado por composição), foco e hover locais podem continuar no componente quando não representam estado de domínio. Critério: se o estado descreve UI ("este menu está aberto") e desaparece com o componente, fica no componente; se descreve domínio ("qual capítulo está em edição inline"), vai para hook.
- **Forms com React Hook Form**: a chamada `useForm()` permanece no componente do formulário (é a forma idiomática), mas o **submit handler**, mutações associadas, refetch e tratamento de erros são extraídos para um hook (ex.: `useCreateStudioForm()` retornando `{ form, onSubmit, isSubmitting, error }`).
- **Páginas (`src/app/**/page.tsx`)**: continuam Server Components quando possível. Quando precisam ser client, seguem a mesma regra.
- **Componentes de layout autenticado (`PageContainer`, `PageHeader`, etc.)**: são apresentacionais e permanecem inalterados.
- **Hooks já existentes em `src/lib/hooks/` (`use-sidebar`, `use-mobile-menu`, `use-auto-save-preference`)**: já seguem o padrão; servem como confirmação de que a infraestrutura está pronta.
- **Migração de capítulos com state machine complexa**: a lógica de transição (`pending → editing → reviewing → ...`) deve sair completamente do componente e residir em um hook dedicado, permitindo testes unitários sem renderização.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Componentes em `src/components/features/**/*.tsx` MUST NOT executar chamadas para a camada de dados diretamente — toda interação com `/api/**`, mutações e refetch DEVEM ser encapsuladas em um hook customizado consumido pelo componente.
- **FR-002**: Componentes em `src/components/features/**/*.tsx` MUST NOT declarar `useState` ou `useReducer` que represente **estado de domínio** (entidade carregada, item em edição, filtros, paginação, modo bulk-delete, status de mutação). Estado puramente visual local (foco, hover, valores de input controlado de pequena escala) permanece permitido.
- **FR-003**: Componentes em `src/components/features/**/*.tsx` MUST NOT usar `useEffect` para data fetching, sincronização com servidor ou orquestração de side-effects de domínio. Esses efeitos DEVEM ser encapsulados em um hook customizado.
- **FR-004**: Toda feature em `src/components/features/<feature>/` que precise de lógica de estado/dados DEVE expor um ou mais hooks customizados co-localizados (ex.: `use-<feature>.ts`, `use-<feature>-form.ts`, `use-<feature>-bulk-delete.ts`) que retornem um objeto contendo dados, derivações memoizadas e callbacks. Hooks reutilizáveis entre múltiplas features ficam em `src/lib/hooks/`.
- **FR-005**: Hooks customizados DEVEM ser cobertos por testes unitários alcançando ≥ 80% das linhas/branches do hook, com banco e rede mockados conforme a convenção de test doubles do projeto.
- **FR-006**: Componentes refatorados DEVEM se reduzir a: (a) bloco de imports, (b) declaração da função, (c) chamada do(s) hook(s), (d) retorno JSX. Lógica condicional dentro do JSX permanece permitida quando é puramente apresentacional (`{loading ? <Skeleton/> : <Table/>}`); lógica condicional que decide o que disparar (mutação, navegação, side-effect) MUST viver no hook.
- **FR-007**: A refatoração das features existentes MUST preservar comportamento observável: as suites `bun run test:integration` e `bun run test:e2e` existentes continuam verdes sem ajustes que escondam regressões.
- **FR-008**: Uma auditoria documentada (lista no spec do plano de implementação) MUST classificar cada um dos componentes em `src/components/features/**` como (a) já conforme, (b) precisa migrar lógica para hook, (c) componente puramente visual fora do escopo.
- **FR-009**: Os princípios da constituição (`.specify/memory/constitution.md`) DEVEM ser amendados para incluir um princípio explícito que defina o padrão "componentes apresentacionais, lógica em hooks", com critérios objetivos para distinguir estado de domínio de estado visual.
- **FR-010**: O arquivo `CLAUDE.md` MUST ser atualizado para listar a regra na seção de Arquitetura e adicionar um item dedicado ao self-review checklist: "Componentes client contêm apenas renderização? Lógica reside em hooks customizados?".
- **FR-011**: Forms construídos com React Hook Form podem manter a chamada `useForm(...)` dentro do componente do formulário, mas DEVEM expor o **submit handler** e a integração com mutações/refetch via hook customizado (`useCreate<Entity>Form`, `useUpdate<Entity>Form`).
- **FR-012**: Server Components, componentes UI primitivos (`src/components/ui/**`) e componentes de layout (`src/components/layout/**`) ficam **fora do escopo** desta refatoração e mantêm seu padrão atual.
- **FR-013**: Convenção de retorno dos hooks: hooks customizados retornam um objeto nomeado (jamais tupla) com chaves auto-documentadas (`{ studios, isLoading, error, createStudio, deleteStudio }`), facilitando consumo no componente e leitura.
- **FR-014**: Regra de lint customizada para detectar violações (`fetch`/`useEffect` de domínio em componentes client) fica **explicitamente fora do escopo** desta feature. Enforcement automatizado por linter pode ser proposto em feature futura dedicada caso a regra falhe na revisão recorrentemente.

### Key Entities *(scope artifacts, not domain entities)*

- **Feature Component (`.tsx`)**: arquivo client component em `src/components/features/<feature>/`. Após refatoração, contém apenas renderização (JSX) parametrizada por dados/callbacks vindos de hook(s).
- **Custom Hook (`use-*.ts(x)`)**: função que encapsula estado, efeitos, mutações e derivações de uma feature. Co-localizada com os componentes da feature ou em `src/lib/hooks/` quando reutilizável.
- **Auditoria de Conformidade**: artefato gerado durante o planejamento, listando cada componente atual e sua classificação (já conforme / precisa migrar / fora do escopo).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos componentes client em `src/components/features/**` que interagem com a camada de dados delegam essa interação a um hook customizado (zero `fetch`/`mutate` inline).
- **SC-002**: 100% dos componentes client em `src/components/features/**` não declaram `useEffect` para data fetching ou sincronização de servidor.
- **SC-003**: Cobertura de testes unitários para hooks customizados criados ou refatorados na feature ≥ 80% (linhas e branches).
- **SC-004**: Após a migração, `bun run test:unit`, `bun run test:integration` e `bun run test:e2e` passam sem regressões atribuíveis à refatoração (zero novos testes falhando que estavam verdes antes).
- **SC-005**: Para cada componente refatorado, o número de linhas do componente `.tsx` cai em pelo menos 30%, ou o componente passa a importar exatamente um hook que centraliza a lógica anteriormente embutida (qualquer um dos dois critérios indica adesão estrutural).
- **SC-006**: Self-review checklist e a constituição contêm um item objetivo sobre o padrão; revisores conseguem apontar violações em PRs em até uma passada.
- **SC-007**: Ao adicionar uma nova feature após a refatoração, o engenheiro produz um par "componente apresentacional + hook" sem precisar consultar regras adicionais — o padrão é visível pelo exemplo das features migradas.

## Assumptions

- A refatoração é **incremental por feature** (uma feature por PR ou conjunto pequeno), não um big-bang. Cada PR mantém o app verde e o comportamento observável intacto.
- Server Components continuam sendo o padrão para páginas que apenas exibem dados; a regra incide somente sobre componentes client.
- A biblioteca React Hook Form permanece como ferramenta canônica para formulários; a separação acontece entre o `useForm()` (fica no componente) e a orquestração do submit + mutações (vai para hook).
- Hooks específicos de uma única feature ficam **co-localizados** em `src/components/features/<feature>/use-*.ts(x)`. Hooks reutilizáveis entre features ficam em `src/lib/hooks/`. A pasta `src/lib/hooks/` já existe e contém exemplos do padrão (`use-sidebar`, `use-mobile-menu`, `use-auto-save-preference`).
- Componentes em `src/components/ui/**` e `src/components/layout/**` permanecem inalterados.
- A suíte de testes existente (unit, integration, e2e) é considerada o oráculo de comportamento observável; mudanças que quebrem testes indicam regressão e bloqueiam o PR.
- Skills `/frontend-patterns` e `/frontend-design` serão consultadas no `/speckit-plan` e durante implementação para detalhamento técnico (composição, hooks, separação container/presentational, naming).
- A regra é orientada a Client Components (`"use client"`); Server Components não precisam de hook companheiro porque já não podem usar hooks de estado.
- Lint rule formal (eslint plugin) está **explicitamente fora do escopo** desta feature (ver Clarifications Q2). Enforcement primário: constituição + CLAUDE.md + self-review + code review. Caso a violação do padrão se torne recorrente em PRs futuros, abrir feature dedicada para implementar a regra.
