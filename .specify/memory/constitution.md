<!--
SYNC IMPACT REPORT
==================
Version change: 2.13.0 → 2.14.0 (MINOR: Clean Architecture clarification.
Principle VI amended to relocate repository interfaces (ports) from
`lib/domain/` to the root of `lib/repositories/`, alongside their
concrete adapters in subpastas como `lib/repositories/drizzle/`. The
domain layer (`lib/domain/`) agora é estritamente livre de
preocupações de persistência — somente entities, value objects, enums
e funções puras. Nenhum princípio novo adicionado; nenhum removido.
Mudança estrutural sem impacto em semântica de domínio ou fluxo de
dados — apenas local físico dos ports. Todos os imports existentes
foram realocados no mesmo commit.)

Modified principles:
  - VI. Arquitetura Limpa no Backend:
    - Repository interfaces (ports) DEVEM residir em
      `lib/repositories/<entidade>-repository.ts` (raiz).
    - `lib/domain/` DEVE ficar livre de interfaces de persistência —
      conterá apenas entities, value objects, enums e regras puras.
    - Adapters concretos continuam em subpastas nomeadas pelo
      mecanismo (ex: `lib/repositories/drizzle/`).

Added sections: N/A

Removed sections: N/A

Templates requiring updates:
  ✅ .specify/memory/constitution.md — este arquivo (atualizado agora)
  ✅ CLAUDE.md — atualizado para refletir a nova localização das
     interfaces de repositório
  ✅ src/lib/domain/ — interfaces `*-repository.ts` removidas
  ✅ src/lib/repositories/ — interfaces realocadas na raiz; imports
     dos services, adapters Drizzle e in-memory fakes atualizados

Follow-up TODOs: N/A.
-->

# AudioBook Track Constitution

## Core Principles

### I. Capítulo como Unidade de Trabalho

O capítulo é a unidade fundamental de produção e pagamento neste sistema.
Toda atribuição de responsabilidade, cálculo de ganho e rastreamento de status
DEVE ser feito no nível do capítulo.

- Cada capítulo DEVE ter exatamente um narrador responsável pela gravação e,
  a partir do status `em edição`, um editor responsável pela edição.
- Horas editadas são registradas por capítulo — não por livro ou estúdio.
- Nenhum pagamento pode ser calculado sem um responsável de edição definido.

**Rationale**: O fluxo de trabalho real divide-se em capítulos. Tratar o livro
como unidade de pagamento mascararia a contribuição individual de cada editor.

### II. Precisão Financeira (NÃO NEGOCIÁVEL)

Todo cálculo de ganho DEVE ser determinístico, rastreável e baseado em dados
persistidos — nunca derivado dinamicamente de valores que podem mudar.

- O preço/hora DEVE ser vinculado ao **livro**, não ao estúdio. Ele é editável
  enquanto o livro não estiver `pago`. Uma vez que o livro atinge o status
  `pago`, o preço torna-se imutável para preservar o histórico financeiro.
- Campos de origem (inteiros, persistidos): `chapter.edited_seconds`
  (integer, segundos) e `book.price_per_hour_cents` (integer, centavos).
- A fórmula de ganho é:
  `round(chapter.edited_seconds × book.price_per_hour_cents / 3600)` →
  **valor em centavos**. A conversão centavos → reais (`÷ 100` +
  formatação BRL) acontece na camada de apresentação. Nomes de campos
  e colunas em inglês no código; labels em português na UI.
- Arredondamento DEVE ser determinístico (`Math.round` half-away-from-zero
  aplicado ao divisor inteiro 3600). A fórmula DEVE ser implementada em
  helper puro (`lib/domain/earnings.ts`) com cobertura unitária de 100%.
- Ganhos calculados DEVEM ser auditáveis: todas as entradas do cálculo
  (horas, preço, responsável, data) DEVEM estar disponíveis para consulta.
- Relatórios de ganho por período DEVEM ser filtráveis por capítulo, livro e
  estúdio sem perda de precisão.

**Rationale**: Erros financeiros afetam diretamente a renda dos editores.
Imutabilidade do preço histórico é obrigatória para confiabilidade do sistema.

### III. Integridade do Ciclo de Vida do Capítulo

Transições de status de capítulo DEVEM ser explícitas e validadas.
Não é permitido pular etapas obrigatórias do ciclo de vida.

**Estados válidos e transições permitidas:**

```
pendente → em edição → em revisão → concluído → pago
                            ↕
                      edição retake   (opcional: revisão reprovada → nova edição → em revisão)
```

| Status | Descrição | Pré-condição para entrar |
|---|---|---|
| `pendente` | Gravação não iniciada | — |
| `em edição` | Gravação finalizada, edição pendente | narrador atribuído |
| `em revisão` | Edição finalizada, revisão pendente | editor + `edited_seconds > 0` registrados |
| `edição retake` | Revisão reprovada, nova edição necessária | revisão explicitamente reprovada |
| `concluído` | Revisão aprovada, aguarda decisão do estúdio | revisão aprovada (de `em revisão`) |
| `pago` | Histórico imutável, edição do livro desabilitada | aprovação do estúdio |

**Transições válidas:**

- `pendente` → `em edição`
- `em edição` → `em revisão`
- `em revisão` → `edição retake` (reprovação) ou `concluído` (aprovação)
- `edição retake` → `em revisão` (após nova edição concluída)
- `concluído` → `pago`

- Toda transição DEVE registrar data e responsável no momento da mudança.
- `edição retake` é um estado opcional: somente ativado se a revisão for
  explicitamente reprovada a partir de `em revisão`.
- Um capítulo marcado como `pago` NÃO PODE ter seus dados financeiros
  alterados retroativamente — edição do livro associado DEVE ser desabilitada.

**Rationale**: O status do capítulo é a fonte de verdade do progresso de
produção e do fluxo de pagamento. Transições inválidas corrompem relatórios
e cálculos de ganho.

### IV. Simplicidade Primeiro (YAGNI)

Implementar apenas o que é necessário para a funcionalidade atual. Abstrações
prematuras e generalizações hipotéticas são proibidas.

- Preferir a solução mais simples que satisfaça o requisito.
- Qualquer complexidade adicionada DEVE ser justificada por um requisito
  concreto existente.
- Não projetar para cenários hipotéticos futuros sem evidência de necessidade.

**Rationale**: Este é um sistema de uso pessoal/pequeno time. Complexidade
desnecessária aumenta custo de manutenção sem benefício real.

### V. Desenvolvimento Orientado a Testes

TDD é obrigatório para toda lógica de domínio, especialmente cálculos
financeiros. O ciclo Red → Green → Refactor DEVE ser seguido.

- Toda lógica de cálculo de ganho DEVE ter cobertura de testes unitários de
  100%.
- Transições de ciclo de vida do capítulo DEVEM ter testes de integração.
- Cobertura mínima geral: 80%.
- Testes são escritos ANTES da implementação — sem exceções.

#### Regras de Classificação de Testes

Todo teste DEVE ser classificado corretamente na categoria correspondente.
Testes fora da categoria correta DEVEM ser movidos antes do merge.

**Unit (`__tests__/unit/`)**

Testa uma única unidade (função, classe, módulo) isolada de dependências
externas.

| Critério | Regra |
|----------|-------|
| Dependências externas | Todas mockadas (DB, HTTP, filesystem, crypto) |
| Banco de dados | Proibido — nenhuma conexão real |
| Setup file | Nenhum (não usa `setup.ts` de integration) |
| Velocidade | < 50ms por teste |
| O que testar | Schemas Zod, funções puras, validações, state machines, config assertions, middleware com deps mockadas |

Regra de ouro: se o teste usa `vi.mock()`, fakes injetados via construtor
ou parâmetro, ou testa função pura → unit test.

**Integration (`__tests__/integration/`)**

Testa a interação entre 2+ componentes reais, especialmente com banco de
dados.

| Critério | Regra |
|----------|-------|
| Dependências externas | Pelo menos uma real (DB, crypto lib, auth lib) |
| Banco de dados | Real (PostgreSQL via transaction rollback) |
| Setup file | Usa `__tests__/integration/setup.ts` |
| Isolamento | Transaction rollback automático entre testes |
| O que testar | CRUD no banco, password hashing + persistência, sessões reais, regras de negócio que tocam o DB, cascade deletes, constraints |

Regra de ouro: se o teste precisa de DB real ou integra múltiplos módulos
sem mock → integration test.

**E2E (`__tests__/e2e/`)**

Testa fluxos completos do usuário pela interface, sem mocks.

| Critério | Regra |
|----------|-------|
| Ferramenta | Playwright (browser real) |
| Mocks | Nenhum — tudo real (app rodando, DB, auth) |
| Servidor | App Next.js rodando (dev ou build) |
| O que testar | Login completo no browser, navegação protegida, formulários, feedback visual, fluxos críticos ponta-a-ponta |

Regra de ouro: se o teste simula ações de um usuário real no browser →
E2E test.

**Árvore de decisão rápida:**

```
O teste usa vi.mock(), fakes injetados ou testa função pura?  → Unit
O teste conecta no banco ou integra módulos?                  → Integration
O teste abre browser e simula usuário?                        → E2E
```

#### Convenção de Test Doubles

Para módulos internos do projeto (`@/lib/`, `@/app/`, etc.), `vi.mock()`
é proibido. Em vez disso, usar injeção de dependência:

1. **Repository fake (classe)**: Quando um service depende de uma interface
   de repository via construtor. Modelo:
   `__tests__/repositories/in-memory-user-preference-repository.ts`.
2. **Fake de função (`vi.fn()`)**: Quando um módulo aceita dependência como
   parâmetro. Modelos: `health-check.test.ts`, `health.test.ts`,
   `instrumentation.test.ts`.

**Allowlist de `vi.mock()` permitidos:**

`vi.mock()` é aceitável apenas para módulos não injetáveis por design:

| Módulo | Categoria |
|--------|-----------|
| `next/headers` | Framework externo (Next.js) |
| `next/navigation` | Framework externo (Next.js) |
| `@axe-core/playwright` | Biblioteca externa |
| `better-auth/cookies` | Biblioteca externa |
| `@/lib/env` | Infraestrutura de ambiente (singleton) |
| `@/lib/db` | Infraestrutura de I/O (singleton PostgreSQL) |

Mocks globais de `@/lib/db` e `@/lib/env` ficam em
`__tests__/unit/setup.ts`.

`vi.fn()` é livre para criar fakes tipados — não exige classes
hand-written para funções simples.

#### Isolamento de Testes e Banco de Dados de Teste

Testes DEVEM ser isolados entre si. Nenhum teste pode observar ou
influenciar dados de outro. A estratégia de isolamento é específica
por camada e é obrigatória.

**Banco de dados de teste separado:**

- Integration e E2E DEVEM operar sobre `audiobook_track_test` —
  nunca `audiobook_track` (dev/prod).
- `TEST_DATABASE_URL` é obrigatória quando `NODE_ENV=test`;
  `DATABASE_URL` é obrigatória nos demais casos. Validação é feita
  via `.superRefine()` no schema Zod de env.
- `DATABASE_URL` NÃO DEVE apontar para a base de teste em nenhum
  ambiente — garante que um teste acidental não corrompa dados de
  desenvolvimento.
- `src/lib/env/schema.ts` é separado de `src/lib/env/index.ts` para
  permitir importar o schema puro sem acionar o mock global de
  `@/lib/env` usado em unit tests (ver Convenção de Test Doubles).

**Integration — BEGIN/ROLLBACK automático:**

- Cada teste roda dentro de uma transação PostgreSQL iniciada em
  `beforeEach` e desfeita em `afterEach` via `ROLLBACK`.
- Mudanças do teste são descartadas; o próximo teste começa com o
  estado pós-migrations. Nenhum teardown manual, nenhum seed
  compartilhado além de `__drizzle_migrations`.

**E2E — schema-per-worker:**

- Cada worker do Playwright recebe um schema PostgreSQL exclusivo
  (`e2e_w{index}_{uuid8}`) na base `audiobook_track_test`.
- Migrations são aplicadas no schema do worker via CLI customizado
  que reescreve referências `"public"."..."` dos arquivos SQL do
  Drizzle para o schema-alvo, e mantém um journal próprio em
  `<schema>.__drizzle_migrations`.
- Cada worker sobe uma instância `next start` em porta dedicada
  (`BASE_E2E_PORT + workerIndex`) com `DATABASE_URL` apontando ao
  schema via `?options=-c search_path=<schema>`.
- O Playwright `globalSetup` roda `next build` uma única vez por
  sessão (cacheado por `BUILD_FRESH_WINDOW_MS`) e os workers
  compartilham `.next/`. Rodar `next dev --turbopack` por worker é
  PROIBIDO — satura CPU em paralelismo ≥ 2 workers.
- Schemas são dropados no teardown do worker. Schemas órfãos são
  identificados por `COMMENT ON SCHEMA` com timestamp ISO e
  limpos pelo `globalSetup` mais pelo script
  `bun run db:test:clean-orphans`.

**E2E — reset entre testes (TRUNCATE seletivo):**

- Fixture auto-scope executa `TRUNCATE ... RESTART IDENTITY CASCADE`
  em `beforeEach`, preservando `user`, `account`, `session` e
  `__drizzle_migrations`.
- O admin seed (única linha de `src/lib/db/seed-test.ts`) é
  preservado durante todo o worker — `login()` funciona em qualquer
  teste sem re-seed.
- DROP + CREATE de schema por teste é PROIBIDO (uma ordem de
  magnitude mais lento que TRUNCATE).

**Flag `E2E_TEST_MODE`:**

- `next start` exige `NODE_ENV=production`. Qualquer configuração
  de auth/backend que precise ser flipada em E2E (rate limit
  desligado, signup habilitado) DEVE usar
  `process.env.E2E_TEST_MODE === "1"`, nunca `NODE_ENV === "test"`.
- Lido por request no runtime — produção fica intocada quando o
  flag não está setado.

**Factory, não seed, para novas entidades:**

- Adicionar uma entidade nova (ex: `book`, `chapter`) NUNCA altera
  `src/lib/db/seed-test.ts`. Esse arquivo existe apenas para criar
  o admin e é a única linha estável entre execuções.
- Dados de teste DEVEM vir de factories em
  `__tests__/helpers/factories.ts` (ex: `createTestBook(db, overrides)`),
  chamadas em `beforeEach` ou no próprio teste.
- O auto-reset do fixture E2E (TRUNCATE seletivo) ou o
  `BEGIN/ROLLBACK` do setup integration limpam entre testes —
  nenhum teardown manual é necessário.

Referência detalhada com diagramas, exemplos e troubleshooting:
[docs/testing-strategy.md](../../docs/testing-strategy.md).

**Rationale**: A confiabilidade dos cálculos financeiros depende de testes
abrangentes. Defeitos em pagamentos impactam diretamente pessoas reais.
Classificação correta dos testes garante que cada tipo execute no ambiente
apropriado e que a pirâmide de testes seja respeitada. Isolamento
automático por camada — schema-per-worker no E2E, BEGIN/ROLLBACK no
integration, TEST_DATABASE_URL separado de DATABASE_URL — permite
paralelismo real sem flakiness e impede que uma execução acidental de
testes corrompa dados de desenvolvimento.

## Engineering Standards

### VI. Arquitetura Limpa no Backend

O backend DEVE seguir Clean Architecture com separação estrita de camadas.
Dependências apontam sempre de fora para dentro — nunca o contrário.

**Camadas obrigatórias** (de fora para dentro):

```
app/api/          → Controllers/Route Handlers (HTTP, entrada/saída)
lib/factories/    → Composition Root (instanciam services com dependências concretas)
lib/services/     → Use Cases / Application Services (orquestração)
lib/repositories/ → Ports (interfaces) na raiz + adapters concretos em subpastas (drizzle/, …)
lib/domain/       → Entities, value objects, enums e regras de negócio puras
```

- Controllers DEVEM ser finos: validam input, chamam uma factory para obter
  o service, e retornam resposta. Nenhuma lógica de negócio nos controllers.
- Respostas de erro padronizadas (401, 422, etc.) DEVEM usar helpers
  reutilizáveis de `lib/api/responses.ts` — nunca construir o envelope de
  erro inline no controller.
- Services contêm toda a orquestração: não conhecem HTTP nem SQL diretamente.
- Repositories encapsulam todo acesso a dados. A **interface (port)** DEVE
  residir em `lib/repositories/<entidade>-repository.ts` (raiz da camada de
  repositórios); **adapters concretos** DEVEM residir em subpastas nomeadas
  pelo mecanismo (ex: `lib/repositories/drizzle/`). A camada de domínio
  (`lib/domain/`) fica LIVRE de preocupações de persistência — nenhuma
  interface de repositório pode ser declarada ali.
- Entities do domínio são POJOs puros — sem imports de framework.
- Injeção de dependência via construtor; nunca instanciar dependências dentro
  de uma classe.

**Factories (Composition Root):**

- Controllers NUNCA instanciam repositories ou services diretamente — DEVEM
  usar factories de `lib/factories/` para obter services prontos.
- Factories são o único lugar que conhece as implementações concretas
  (ex: `DrizzleUserPreferenceRepository`) e as conecta aos services.
- Cada domínio DEVE ter sua factory em arquivo próprio
  (ex: `lib/factories/user-preference.ts`).
- Factories DEVEM expor funções nomeadas `create<Service>()` (ex:
  `createUserPreferenceService()`).

**Convenções de Nomeação:**

- Interfaces DEVEM ser definidas em arquivos separados — nunca co-localizadas
  com implementações ou com tipos de domínio no mesmo arquivo.
- Interfaces NÃO DEVEM usar o prefixo `I`. Exemplo correto:
  `UserPreferenceRepository` (interface), não `IUserPreferenceRepository`.
- Implementações concretas de repositories DEVEM ser prefixadas com o nome
  do adaptador/driver. Exemplo: `DrizzleUserPreferenceRepository` implementa
  `UserPreferenceRepository`.

**Rationale**: Em um sistema financeiro, separar regras de negócio da
infraestrutura garante que os cálculos sejam testáveis sem banco de dados
e que mudanças de storage não afetem a lógica de domínio.

### VII. Frontend: Composição, Atomicidade e Mobile First

O frontend DEVE separar lógica de renderização e seguir composição sobre
herança. Componentes DEVEM ser atômicos e independentes.

**Mobile First (obrigatório):**

- Todas as telas DEVEM ser desenvolvidas com abordagem mobile first:
  estilizar primeiro para telas pequenas e usar breakpoints progressivos
  (`sm:`, `md:`, `lg:`, `xl:`) para adaptar a telas maiores.
- Esta prática é nativa do Tailwind CSS (utility-first, mobile-first por
  padrão) e DEVE ser seguida em todos os componentes e layouts.
- Layouts responsivos DEVEM ser testados em pelo menos 3 breakpoints:
  mobile (< 640px), tablet (640–1024px) e desktop (> 1024px).
- Componentes que não se adaptam a telas menores DEVEM ser justificados
  explicitamente (ex: dashboards complexos com fallback mobile).

**shadcn/ui como biblioteca de componentes padrão:**

- **shadcn/ui** é a biblioteca de componentes UI oficial deste projeto.
- Antes de criar qualquer componente primitivo (Button, Input, Dialog,
  Select, Table, Badge, Card, etc.), DEVE-se verificar se existe um
  equivalente no shadcn/ui e usá-lo.
- Construir componentes primitivos do zero quando shadcn/ui oferece
  equivalente é **proibido** — usar
  `bunx --bun shadcn@latest add <component>`.
- A flag `--bun` é **obrigatória** ao executar o CLI do shadcn com Bun
  como runtime. Exemplo: `bunx --bun shadcn@latest add accordion`.
- Componentes shadcn/ui podem ser customizados via props, className
  (Tailwind) e design tokens — não via fork ou reescrita.
- Componentes compostos específicos do domínio (ex: ChapterRow,
  PaymentSummary) DEVEM ser construídos **compondo** componentes
  shadcn/ui, não substituindo-os.

**Uso obrigatório de componentes de `components/ui/` (NUNCA HTML cru):**

- Elementos HTML primitivos (`<button>`, `<input>`, `<select>`,
  `<textarea>`, `<label>`) são **proibidos** quando existe um
  componente equivalente em `components/ui/`.
- DEVE-se usar `<Button>`, `<Input>`, `<Select>`, `<Textarea>`,
  `<Label>`, etc. importados de `@/components/ui/`.
- Isto garante consistência visual, suporte a dark mode, e aderência
  aos design tokens em todo o projeto.

**Componentes de layout para consistência de páginas:**

- Toda página autenticada DEVE usar os componentes de layout de
  `components/layout/page-container.tsx`:
  - `<PageContainer>` — wrapper principal da página.
  - `<PageHeader>` — container do cabeçalho da página.
  - `<PageTitle>` — título `<h1>` da página.
  - `<PageDescription>` — subtítulo/descrição da página.
- Componentes comuns entre páginas DEVEM ser componentizados para
  manter consistência visual e comportamental.

**Dark mode obrigatório:**

- Todo componente e página DEVE funcionar corretamente em modo claro
  e modo escuro.
- Usar classes Tailwind com suporte a dark mode via `next-themes`
  (ex: `bg-background`, `text-foreground`, tokens semânticos).
- NUNCA usar cores hardcoded que não se adaptam ao tema.
- Testar visualmente ambos os modos antes de considerar a
  implementação concluída.

**Arquivo de design como referência:**

- O arquivo `design.pen` na raiz do projeto é a referência visual
  para construção de telas.
- Antes de construir qualquer tela nova, DEVE-se consultar
  `design.pen` via Pencil MCP para entender o layout, espaçamentos,
  cores e hierarquia visual pretendidos.
- O design serve como guia — adaptações são permitidas quando
  justificadas por limitações técnicas ou de acessibilidade.

**Estrutura de componentes:**

```
components/ui/        → shadcn/ui primitivos (Button, Input, Badge, Card, etc.)
components/features/  → Moléculas: ChapterRow, PaymentSummary (composição de ui/ + lógica de domínio)
app/                  → Pages/Layouts (Next.js App Router, SSR por padrão)
hooks/                → Custom hooks isolam lógica de estado e side effects
```

**Localização de Componentes de Feature (obrigatório):**

- Componentes de feature (moléculas compostas, específicas de um
  domínio como `editors`, `narrators`, `chapters`) DEVEM residir em
  `src/components/features/<feature>/` e serem importados via alias
  `@/components/features/<feature>/...`.
- Pastas `_components/` (ou qualquer variante colocada dentro de
  `src/app/` para colocar componentes junto à rota via underscore
  prefix do Next.js) são **PROIBIDAS**. A convenção Next.js de pasta
  privada NÃO DEVE ser usada para componentes de UI.
- Route handlers, layouts e páginas em `src/app/` DEVEM importar
  componentes exclusivamente de `@/components/ui/`,
  `@/components/layout/` e `@/components/features/<feature>/` —
  nunca de pastas colocadas dentro da própria árvore de rotas.
- Caso um componente seja usado por apenas uma rota hoje, ainda
  assim DEVE residir em `src/components/features/<feature>/`. O
  custo de mover o arquivo no futuro é maior do que o "ganho" de
  proximidade à rota.

- Componentes de UI (átomos) DEVEM ser puramente visuais — apenas props e
  renderização, sem useState ou fetch.
- Lógica de estado e data fetching DEVEM residir em custom hooks ou Server
  Components — nunca inline em JSX.
- Data fetching DEVE usar Server Components com `async/await` direto quando
  os dados são necessários no servidor. Usar `use client` apenas quando
  interatividade é obrigatória.
- `fetch` no servidor DEVE usar `cache: 'no-store'` para dados mutáveis e
  `next: { revalidate: N }` para dados semi-estáticos.
- Composição via `children` e slot props é preferida a boolean props que
  alteram renderização.

**Rationale**: Separar lógica de renderização permite testar cada parte
isoladamente e facilita SSR sem hidratação desnecessária no cliente.

### VIII. Performance em Primeiro Lugar

O tempo de carregamento inicial (LCP) DEVE ser inferior a 1 segundo.
Toda decisão técnica DEVE considerar impacto na performance.

- Server Components são o padrão; `use client` apenas quando necessário.
- Imagens DEVEM usar `<Image>` do Next.js com `priority` nas above-the-fold.
- Fontes DEVEM usar `next/font` com `display: swap`.
- Listas longas (> 50 itens) DEVEM usar virtualização
  (`@tanstack/react-virtual`).
- Bundle size: nenhuma dependência de cliente pode ser adicionada sem
  justificativa de que não existe alternativa server-side.
- Lazy loading obrigatório para componentes pesados com `React.lazy` +
  `Suspense`.
- HTTP cache headers DEVEM ser configurados em todas as rotas de API:
  dados estáticos `Cache-Control: public, max-age=60`; dados dinâmicos
  `Cache-Control: no-store`.
- Turbopack DEVE ser usado no desenvolvimento (`next dev` sem flags extras).

**Rationale**: Este app é pequeno — 1s de LCP é alcançável e não negociável.
Performance não é otimização prematura aqui; é requisito de qualidade.

### IX. Design Tokens para Tudo

Valores visuais (cores, espaçamentos, tipografia, bordas, sombras) DEVEM
ser definidos como design tokens no Tailwind config ou CSS custom properties.
Nenhum valor hardcoded pode aparecer em componentes.

- Tokens DEVEM ser definidos em `tailwind.config.ts` sob `theme.extend`.
- Hierarquia de tokens:
  - **Primitivos**: `color.slate.900`, `spacing.4` (valores base)
  - **Semânticos**: `color.text.primary`, `color.surface.card` (intenção)
  - **Componente**: `button.padding`, `card.radius` (quando necessário)
- Componentes DEVEM referenciar tokens semânticos, não primitivos.
- Dark mode DEVEM ser implementado via tokens CSS (`--color-text-primary`)
  mapeados no `:root` e `[data-theme="dark"]`.
- Nenhum `style={{ color: '#xxx' }}` inline é permitido.

**Rationale**: Design tokens garantem consistência visual e facilitam
mudanças de tema sem varrer todos os componentes.

### X. Padrões de API REST

Todas as rotas de API DEVEM seguir os padrões REST definidos nesta seção.

**URLs:**

- Recursos em plural, kebab-case: `/api/v1/chapter-payments`
- Sub-recursos para relacionamentos: `/api/v1/books/:id/chapters`
- Sem verbos na URL; ações excepcionais: `/api/v1/chapters/:id/mark-paid`

**HTTP e Status Codes:**

- `200` para GET/PATCH com body; `201` para POST (+ `Location` header);
  `204` para DELETE.
- `400` para JSON malformado; `422` para dados semanticamente inválidos;
  `404` para recurso inexistente; `409` para conflito de estado.
- NUNCA retornar `200` com `{ success: false }` no body.

**Response envelope:**

```typescript
// Sucesso (single)
{ "data": { ...resource } }

// Sucesso (lista)
{ "data": [...], "meta": { total, page, per_page } }

// Erro
{ "error": { "code": "string", "message": "string", "details"?: [...] } }
```

- Input DEVE ser validado com Zod em todas as rotas.
- Erros de validação DEVEM incluir `details` com campo + mensagem.
- Stack traces e mensagens de SQL NUNCA devem aparecer em respostas de erro.
- Paginação: cursor-based para listas grandes; offset para admin/pequenas.

**Rationale**: Contratos de API consistentes reduzem bugs de integração e
facilitam debugging quando algo falha em produção.

### XI. PostgreSQL e Banco de Dados

O banco de dados DEVE ser PostgreSQL. Todas as interações DEVEM passar
pelo Repository Pattern definido no Princípio VI.

- Tipos corretos: `bigint` para IDs, `text` para strings, `timestamptz`
  para datas, **`integer` em centavos para valores monetários (preferido)
  OU `numeric(10,2)` (legado/compatibilidade)** — `float`/`double` são
  proibidos.
- Durações que alimentam cálculo financeiro DEVEM ser `integer` em
  segundos (ex: `edited_seconds`), não `numeric` em horas. Conversão
  para unidades apresentáveis (horas, minutos) ocorre na UI.
- Nomes de colunas monetárias e de duração DEVEM explicitar a unidade
  no sufixo: `_cents` para centavos, `_seconds` para segundos.
- Todo foreign key DEVE ter índice correspondente.
- Índices compostos: colunas de igualdade primeiro, range depois.
- Índice parcial para registros ativos:
  `CREATE INDEX idx ON t (col) WHERE deleted_at IS NULL`.
- Transações DEVEM ser usadas para operações que afetam múltiplas tabelas.
- Queries DEVEM selecionar apenas colunas necessárias — proibido `SELECT *`
  em código de produção.
- N+1 queries são proibidas: usar batch fetch ou JOINs.
- Paginação por cursor preferida a OFFSET para listas grandes.
- Migrations DEVEM ser reversíveis e aplicadas via ferramenta de migração.
- **Drizzle ORM**: usar exclusivamente `drizzle-kit generate` (para gerar
  SQL de migração) e `drizzle-kit migrate` (para aplicar). O comando
  `drizzle-kit push` é **proibido** — ele aplica mudanças direto no banco
  sem gerar arquivos de migração, causando dessincronização entre o estado
  do banco e o journal de migrações.

**Rationale**: Valores financeiros em `float` introduzem erros de ponto
flutuante. Inteiros em centavos dão aritmética exata e cálculos
determinísticos (Princípio II). Índices inadequados causam degradação
sob volume real de dados.

### XII. Anti-Padrões Proibidos

Os seguintes padrões são **explicitamente proibidos** neste projeto:

**Backend:**
- Lógica de negócio em controllers/route handlers.
- SQL direto fora de repositories.
- `any` em TypeScript sem comentário justificando.
- Segredos hardcoded — usar variáveis de ambiente validadas no startup.
- `console.log` em produção — usar structured logger.
- Mutations de objetos recebidos como parâmetros — sempre retornar novo objeto.

**Frontend:**
- `fetch` em `useEffect` para dados que podem ser buscados no servidor.
- `useEffect` para derivar estado — usar `useMemo`.
- Props booleanas que alteram estrutura de renderização
  (`isLarge`, `showHeader`) — usar composição.
- Valores visuais hardcoded (cores, espaçamentos) fora de design tokens.
- `use client` em componentes que não requerem interatividade client-side.
- Componentes com mais de 200 linhas — extrair lógica em hooks ou
  sub-componentes.
- Construir componente primitivo do zero (Button, Input, Dialog, Select,
  Table, etc.) quando shadcn/ui oferece equivalente — usar shadcn/ui.
- Usar elementos HTML crus (`<button>`, `<input>`, `<select>`, etc.)
  quando existe componente equivalente em `components/ui/`.
- Criar página autenticada sem usar `<PageContainer>` e componentes
  de layout de `components/layout/`.
- Ignorar dark mode — todo componente DEVE funcionar em ambos os temas.
- Cores hardcoded que não se adaptam ao tema (ex: `text-gray-900`
  sem equivalente dark).
- Criar pasta `_components/` (ou similar) dentro de `src/app/` para
  colocar componentes de UI junto à rota. Componentes de feature
  DEVEM ficar em `src/components/features/<feature>/` (ver
  Princípio VII).

**Banco de dados:**
- `float` ou `double` para valores financeiros.
- `SELECT *` em queries de produção.
- Foreign keys sem índice.
- Migrations irreversíveis sem aprovação explícita.
- `drizzle-kit push` — usar `generate` + `migrate` para manter journal sincronizado.

**Geral:**
- Swallow silencioso de erros (`catch (e) {}`).
- Abstrações para uso único (DRY ≠ criar utility para uma linha usada 1x).
- Feature flags ou shims de compatibilidade sem requisito concreto.

**Rationale**: Anti-padrões documentados explicitamente são mais fáceis de
detectar em code review do que princípios positivos vagos.

### XIII. Métricas e KPIs de Produção

O sistema DEVE expor métricas e gráficos de produção no dashboard para
apoiar decisões do estúdio. Todos os dados DEVEM ser calculados no servidor.

#### KPIs do Dashboard (versão inicial)

| # | KPI | Definição |
|---|---|---|
| 1 | **Ganho do período** | Soma de `round(chapter.edited_seconds × book.price_per_hour_cents / 3600)` dos capítulos com status `paid` no intervalo selecionado. Resultado em centavos; formatação BRL na UI |
| 2 | **Capítulos concluídos do período** | Contagem de capítulos que atingiram `completed` ou `paid` no intervalo selecionado |
| 3 | **Livros em andamento** | Contagem de livros com ao menos 1 capítulo em status diferente de `pending` e diferente de `paid`, agrupados também por número de estúdios distintos |
| 4 | **Minutagem média por capítulo** | `AVG(chapter.edited_seconds) / 60` dos capítulos com status ∈ {`reviewing`, `retake`, `completed`, `paid`} e `edited_seconds > 0`. Unidade: minutos. A conversão segundos→minutos acontece na camada de apresentação; nenhum campo novo é necessário — reusa a mesma fonte dos KPIs 1 e 5 |
| 5 | **Previsão de receita a receber** | Soma de `round(chapter.edited_seconds × book.price_per_hour_cents / 3600)` dos capítulos com status entre `editing` e `completed` (não `paid`) — receita pendente caso todos sejam concluídos. Resultado em centavos |

**Regras dos KPIs:**
- KPI 1 e 2: filtráveis por intervalo de datas (padrão: mês corrente).
- KPI 3: exibe `N livros em andamento de M estúdio(s)`.
- KPI 4: capítulos com `edited_seconds = 0` DEVEM ser excluídos do cálculo
  para evitar viés (representam capítulos ainda não cronometrados) e para
  prevenir divisão por zero em agregações relacionadas. Capítulos em status
  `pending` ou `editing` também não contam — a minutagem só é confiável a
  partir de `reviewing`.
- KPI 5: exclui capítulos `paid` e `pending`; considera apenas capítulos
  com editor atribuído e `edited_seconds > 0`.

#### Gráficos do Dashboard (versão inicial)

| # | Gráfico | Tipo | Eixos / Agrupamento |
|---|---|---|---|
| 1 | **Ganho do período** | Linha ou Barras | Eixo X: data (agrupável por semana ou mês); Eixo Y: valor em R$ |
| 2 | **Ganho por estúdio do período** | Barras empilhadas ou agrupadas | Eixo X: estúdio; Eixo Y: valor em R$; filtro de período |
| 3 | **Ganho por editor** | Barras horizontais | Eixo X: valor em R$; Eixo Y: nome do editor; filtro de período |

**Regras dos gráficos:**
- Todos os gráficos consideram apenas capítulos com status `paid` no período.
- Gráfico 1: agrupamento padrão por semana; opção de alternar para mês.
- Gráfico 2: período sincronizado com o filtro global do dashboard.
- Gráfico 3: ordenado por ganho decrescente.
- Dados dos gráficos DEVEM ser servidos via API route dedicada com
  paginação/agregação no banco — nunca carregar todos os registros no cliente.

**Rationale**: KPIs e gráficos bem definidos permitem ao estúdio tomar
decisões baseadas em dados reais de produção e previsibilidade financeira.

### XIV. Visualização de PDF do Livro

Cada livro PODE ter um PDF associado para consulta digital do conteúdo
original. O PDF viewer é uma funcionalidade de leitura — não de edição.

- O campo `pdf_url` no livro armazena a URL do arquivo PDF (armazenamento
  externo: S3, Cloudflare R2, ou similar). Livros sem PDF são válidos.
- O PDF viewer DEVE ser carregado com lazy loading (`React.lazy` + `Suspense`)
  — nunca incluído no bundle inicial.
- A URL do PDF DEVE ser validada no upload (tipo MIME `application/pdf`).
- Acesso ao PDF DEVE respeitar as mesmas permissões de acesso ao livro.
- O viewer DEVE suportar navegação por página e zoom básico.
- Dados do PDF (metadados, número de páginas, duração estimada) NÃO devem
  sobrescrever configurações manuais do capítulo (`edited_seconds`,
  `narrator_id`, `editor_id`).

**Rationale**: O PDF serve como referência para narradores e revisores
sem necessidade de arquivos externos ao sistema.

### XV. Ferramentas e Skills Obrigatórias

O desenvolvimento DEVE utilizar as skills e ferramentas listadas abaixo
para manter consistência, qualidade e aderência aos padrões do projeto.

**Skills de workflow (usar nos momentos indicados):**

| Skill | Quando usar |
|---|---|
| `/speckit.specify` | Criar especificação de nova feature |
| `/speckit.plan` | Criar plano de implementação |
| `/speckit.tasks` | Gerar lista de tarefas |
| `/speckit.implement` | Executar implementação do plano |
| `/speckit.analyze` | Verificar consistência entre artefatos |
| `/conventional-commits` | Ao escrever mensagens de commit |
| `/finish-task` | Ao finalizar feature (cria PR, verifica CI) |
| `/tdd` | Ao iniciar implementação (TDD workflow) |
| `/code-review` | Após escrever código (revisão de qualidade) |
| `/simplify` | Após implementação (limpeza e refatoração) |
| `/e2e` | Para gerar e rodar testes E2E com Playwright |

**Skills de referência (consultar antes de implementar):**

| Skill | Domínio |
|---|---|
| `/shadcn` | Componentes shadcn/ui (buscar, adicionar, debugar) |
| `/docs` ou `/context7-mcp` | Documentação atualizada de libs via Context7 MCP |
| `/api-design` | Padrões de API REST |
| `/backend-patterns` | Arquitetura backend e otimização |
| `/postgres-patterns` | Queries, schema design, indexação PostgreSQL |
| `/frontend-patterns` | Padrões React, Next.js, state management |
| `/frontend-design` | Design de interfaces com alta qualidade visual |
| `/vercel-composition-patterns` | Composição de componentes React escaláveis |
| `/ui-ux-pro-max` | Referência de design UI/UX (estilos, paletas, padrões) |

**Context7 MCP (obrigatório para documentação de libs):**

- Antes de usar qualquer API de biblioteca, framework ou ferramenta,
  DEVE-se consultar a documentação atualizada via Context7 MCP
  (`resolve-library-id` + `query-docs`).
- Isto se aplica a: Next.js, React, Drizzle ORM, better-auth, Zod,
  shadcn/ui, Tailwind CSS, Playwright, e qualquer outra dependência.
- Não confiar em conhecimento do modelo para APIs que podem ter mudado
  entre versões — sempre verificar via Context7.

**Rationale**: Skills padronizadas garantem que o workflow seja
reproduzível e que boas práticas sejam aplicadas consistentemente,
independente de quem ou o que está executando a tarefa.

### XVI. Qualidade de Código e Verificação

Verificações completas de qualidade (lint, build, suíte de testes)
NÃO DEVEM ser executadas a cada task ou fase intermediária. Elas DEVEM
ser executadas em uma **fase final de verificação** única, antes de
marcar a feature como concluída ou abrir o PR.

**Durante a implementação (fases intermediárias):**

- Rodar apenas os testes diretamente relacionados à mudança atual
  (ex: arquivo de teste recém-escrito em TDD). Eles DEVEM estar
  verdes antes de prosseguir para a próxima task.
- `bun run lint` e `bun run build` NÃO precisam ser executados a
  cada task/fase. Editor e autoformat locais cobrem o loop rápido.
- Suítes completas (`bun run test:unit`, `bun run test:integration`,
  `bun run test:e2e`) NÃO DEVEM ser rodadas após cada task por
  padrão — isto gera atrito desproporcional ao risco.

**Fase final de verificação (obrigatória antes do PR):**

Antes de marcar a feature como concluída, abrir PR ou executar
`/finish-task`, as seguintes verificações DEVEM passar **todas**,
nesta ordem:

1. `bun run lint` — zero erros e zero warnings do Biome.
2. `bun run test:unit` — toda a suíte passando.
3. `bun run test:integration` — toda a suíte passando.
4. `bun run test:e2e` — quando a mudança afeta fluxos cobertos por E2E.
5. `bun run build` — build de produção compila sem erros.

Se qualquer uma falhar, a feature NÃO está concluída. Corrigir antes
de avançar.

**Regras de uso dos scripts (sempre válidas):**

- SEMPRE usar os scripts definidos no `package.json` em vez de chamar
  ferramentas diretamente. Exemplo:
  - CORRETO: `bun run test:unit`
  - PROIBIDO: `bun vitest run __tests__/unit/`
  - CORRETO: `bun run lint`
  - PROIBIDO: `bunx biome check .`
- Isto garante que configurações, flags e paths sejam consistentes
  com o que o projeto espera.

**Rationale**: Rodar lint + build + suíte inteira a cada task gera
ruído repetitivo e atraso desproporcional em um projeto pequeno.
Concentrar a verificação completa em uma fase final preserva a
garantia de qualidade antes do merge sem penalizar o ciclo de
desenvolvimento iterativo. Os testes TDD da própria mudança, rodando
localmente, já servem como sinal rápido durante a implementação.

## Domain Model Constraints

Restrições que se aplicam ao modelo de dados e às entidades do sistema:

- **Estúdio**: entidade mestre com nome e lista de livros. Estúdios não são
  frequentemente criados — o foco do sistema não é gestão de estúdios.
- **Livro**: pertence a um estúdio; carrega o `price_per_hour_cents`
  (integer, centavos — editável até o livro atingir o status `paid`,
  imutável a partir daí para preservar histórico financeiro). O número de
  capítulos é definido na criação do livro. Pode ter um `pdf_url`
  associado (opcional).
- **Capítulo**: pertence a um livro; tem `status`, `narrator_id`
  (responsável pela gravação), `editor_id` (responsável pela edição) e
  `edited_seconds` (integer, segundos — alimenta a fórmula de ganho e o
  KPI 4 "Minutagem média por capítulo" via conversão `÷ 60`). É a
  entidade central do sistema.
  Status possíveis (valor no DB / rótulo em UI): `pending` (Pendente),
  `editing` (Em edição), `reviewing` (Em revisão), `retake` (Retake),
  `completed` (Concluído), `paid` (Pago).
- **Narrador**: responsável pela gravação dos capítulos.
- **Editor**: identificado pelo nome; recebe pagamentos baseados em horas
  editadas em capítulos atribuídos a ele.
- Relacionamentos: Estúdio 1→N Livros; Livro 1→N Capítulos.
- Nenhuma entidade órfã é permitida (capítulo sem livro, livro sem estúdio).

## Development Workflow

Processo de desenvolvimento que DEVE ser seguido em todas as features:

1. **Especificação primeiro**: Toda feature começa com `spec.md` aprovada
   (usar `/speckit.specify`).
2. **Plano técnico**: `plan.md` com decisões de arquitetura antes de codar
   (usar `/speckit.plan`). Consultar `design.pen` via Pencil MCP para
   referência visual de telas novas.
3. **Documentação de libs**: Antes de implementar, consultar documentação
   atualizada via Context7 MCP para todas as libs utilizadas.
4. **TDD**: Testes escritos e falhando antes da implementação
   (ver Princípio V, usar `/tdd`).
5. **Verificação de qualidade (fase final única)**: Antes de abrir
   PR ou marcar feature como concluída, executar `bun run lint`,
   `bun run test:unit`, `bun run test:integration`, `bun run test:e2e`
   (quando aplicável) e `bun run build`. Durante fases intermediárias,
   rodar apenas os testes da mudança atual (ver Princípio XVI).
6. **Code Review**: Revisão obrigatória antes de merge. Verificar
   conformidade com os Princípios I–XVI (usar `/code-review`).
7. **Commits convencionais**: `feat:`, `fix:`, `refactor:`, `test:`,
   `docs:` (usar `/conventional-commits`).
8. **Finalização**: Usar `/finish-task` para criar PR contra `main`.

**Branch principal**: `main`. Todos os PRs DEVEM ser abertos contra
`main`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) DEVE
passar por revisão dupla antes de ser mesclada.

**Idioma dos artefatos de especificação:**

- Nos artefatos gerados pelo workflow do speckit (`spec.md`, `plan.md`,
  `tasks.md`, checklists, `research.md`, `data-model.md`), títulos e
  textos em negrito originados dos templates (`.specify/templates/`)
  DEVEM permanecer em **inglês**.
- O **conteúdo descritivo** que preenche os placeholders dos templates
  (user stories, descrições de requisitos, cenários, premissas, notas)
  DEVE ser escrito em **português brasileiro (pt-BR)**.
- Termos técnicos em inglês (nomes de ferramentas, padrões, APIs,
  tokens CSS, classes Tailwind) podem ser mantidos sem tradução.
- Commits e nomes de branch permanecem em inglês (padrão conventional
  commits).

**Rationale**: O projeto é desenvolvido por um time que opera em
português. O conteúdo descritivo dos artefatos é documentação de
comunicação e alinhamento — deve ser escrito no idioma nativo do
time. Títulos e labels estruturais dos templates permanecem em inglês
para manter compatibilidade com as ferramentas do speckit.

## Governance

Esta constituição **substitui** todas as outras práticas de desenvolvimento
em caso de conflito.

- Emendas requerem: documentação da motivação, análise de impacto nas
  entidades financeiras, e atualização da versão seguindo semver:
  - MAJOR: remoção ou redefinição incompatível de princípio existente.
  - MINOR: novo princípio ou seção adicionada.
  - PATCH: esclarecimentos, correções de redação, refinamentos não semânticos.
- Todo PR DEVE verificar conformidade com os Princípios I–XVI antes do merge.
- Complexidade adicionada DEVE ser justificada explicitamente no PR.
- A Seção de Constraints de Domínio é atualizada sempre que novas entidades
  forem introduzidas.
- Anti-padrões detectados em review DEVEM ser corrigidos antes do merge —
  não podem ser adiados como "débito técnico".

## Self-Review Obrigatório

**Antes de finalizar qualquer código, liste explicitamente como ele cumpre
os itens desta constituição.**

Use o checklist abaixo como resposta ao seu próprio código antes de
submeter para review ou merge:

```markdown
## Self-Review Checklist

### Domínio e Negócio
- [ ] I.   Operações ocorrem no nível do capítulo (não livro/estúdio)?
- [ ] II.  Cálculos financeiros são determinísticos e auditáveis?
- [ ] III. Transições de status são validadas e registram data/responsável?
- [ ] III. Transições inválidas (pular estado, retroceder sem reprovação) são bloqueadas?
- [ ] IV.  Existe complexidade que não é exigida pelo requisito atual?
- [ ] V.   Testes foram escritos ANTES da implementação e a cobertura é ≥ 80%?
- [ ] V.   Testes estão classificados corretamente (unit/integration/e2e por critério definido)?

### Arquitetura e Código
- [ ] VI.   Lógica de negócio está no Service/Domain, não no Controller?
- [ ] VI.   Dependências apontam de fora para dentro (Controller→Service→Repo→Domain)?
- [ ] VII.  Componentes UI são puramente visuais (sem fetch/useState de negócio)?
- [ ] VII.  Componentes primitivos usam shadcn/ui (não construídos do zero)?
- [ ] VII.  Data fetching usa Server Components quando possível?
- [ ] VII.  Layout segue abordagem mobile first (estilos base para mobile, breakpoints progressivos)?
- [ ] VIII. A mudança não adiciona peso desnecessário ao bundle do cliente?
- [ ] VIII. Listas longas usam virtualização?
- [ ] IX.   Todos os valores visuais usam design tokens (sem hardcode)?
- [ ] X.    Endpoints seguem convenção REST (URL, método, status code, envelope)?
- [ ] X.    Input validado com Zod? Erros não expõem detalhes internos?
- [ ] XI.   Queries selecionam apenas colunas necessárias (sem SELECT *)?
- [ ] XI.   Novos foreign keys têm índice?
- [ ] XI.   Valores monetários usam `integer` em centavos (preferido) ou `numeric(10,2)` (legado)? Nunca `float`/`double`?
- [ ] XI.   Durações que alimentam cálculo financeiro usam `integer` em segundos, com sufixo `_seconds` no nome?
- [ ] XIII. KPIs calculados no servidor? Divisão por zero no KPI 4 prevenida (capítulos com `edited_seconds = 0` excluídos)?
- [ ] XIII. Gráficos servidos via API route com agregação no banco (não no cliente)?
- [ ] XIII. KPI 5 (previsão) exclui capítulos `pago` e `pendente`?
- [ ] XIV.  PDF viewer carregado via lazy loading? URL validada no upload?

### Ferramentas e Verificação
- [ ] XV.  Skills apropriadas foram usadas no workflow (speckit, tdd, etc.)?
- [ ] XV.  Documentação de libs consultada via Context7 MCP antes de implementar?
- [ ] XV.  Arquivo `design.pen` consultado para telas novas?
- [ ] XVI. Fase final de verificação executada antes do PR?
- [ ] XVI. `bun run lint` passou sem erros ou warnings (gate final)?
- [ ] XVI. `bun run test:unit` e `bun run test:integration` passaram (gate final)?
- [ ] XVI. `bun run test:e2e` rodado quando aplicável (gate final)?
- [ ] XVI. `bun run build` compilou sem erros (gate final)?
- [ ] XVI. Scripts do `package.json` usados (não comandos diretos)?

### Anti-Padrões
- [ ] Nenhum `any` sem justificativa?
- [ ] Nenhum segredo hardcoded?
- [ ] Nenhum `useEffect` para derivar estado (usar `useMemo`)?
- [ ] Nenhum valor visual hardcoded fora de design tokens?
- [ ] Nenhum `use client` desnecessário (componente poderia ser Server Component)?
- [ ] Nenhum elemento HTML cru quando existe componente em `ui/`?
- [ ] Nenhuma página sem `<PageContainer>` e componentes de layout?
- [ ] Nenhuma pasta `_components/` dentro de `src/app/` (componentes de feature em `src/components/features/<feature>/`)?
- [ ] Dark mode funciona corretamente em todos os componentes novos?
- [ ] Erros são tratados explicitamente (sem `catch (e) {}`)?
```

**Rationale**: A auto-revisão explícita torna o código mais fácil de
revisar por outros e cria responsabilidade pessoal com os padrões
definidos nesta constituição.

**Version**: 2.14.0 | **Ratified**: 2026-03-29 | **Last Amended**: 2026-04-24
