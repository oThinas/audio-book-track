# AudioBook Track — Instruções para Claude

> A constituição completa do projeto está em [.specify/memory/constitution.md](.specify/memory/constitution.md).
> Este arquivo contém as regras mais críticas inline para garantir adesão imediata.
> **Em caso de conflito, a constituição prevalece.**

---

## Regras Não-Negociáveis

### Domínio

- **Capítulo é a unidade central** — atribuição, cálculo de ganho e status operam sempre no nível do capítulo, nunca no livro ou estúdio.
- **Preço/hora é imutável quando o livro está `pago`** — vinculado ao livro, nunca ao estúdio; não pode ser recalculado retroativamente após esse status.
- **Fórmula de ganho**: `horas_editadas × preço_hora_do_livro` — determinística, auditável, sem derivação dinâmica.
- **Ciclo de vida do capítulo**: `pendente` → `em edição` → `em revisão` → [`edição retake`] → `concluído` → `pago`. Nenhuma etapa obrigatória pode ser pulada.
  - `em edição` exige narrador atribuído.
  - `em revisão` exige editor + horas_editadas registrados.
  - `edição retake` é opcional — ativado somente por reprovação em `em revisão`; retorna a `em revisão`.
  - `concluído` exige revisão aprovada.
  - `pago` torna os dados financeiros imutáveis e desabilita edição do livro.
- **Capítulo marcado como `pago` não pode ter dados financeiros alterados.**

### Arquitetura

- **Camadas obrigatórias** (dependências de fora para dentro):
  ```
  app/api/          → Controllers (HTTP apenas, sem lógica de negócio)
  lib/factories/    → Composition Root (instanciam services com deps concretas)
  lib/services/     → Use Cases (orquestração, sem SQL/HTTP direto)
  lib/repositories/ → Implementações concretas de repositories (dados)
  lib/domain/       → Entidades, regras puras e interfaces de repositories
  lib/api/          → Helpers de resposta HTTP reutilizáveis (responses.ts)
  ```
- **Injeção de dependência via construtor** — nunca instanciar dependências dentro de uma classe.
- **Factories obrigatórias** — controllers NUNCA instanciam repos/services diretamente; usam `lib/factories/` com funções `create<Service>()`.
- **Respostas de erro padronizadas** — usar helpers de `lib/api/responses.ts` (ex: `unauthorizedResponse`, `validationErrorResponse`).
- **Interfaces em arquivos separados** — nunca co-localizadas com implementações ou tipos de domínio.
- **Sem prefixo `I` em interfaces** — usar `UserPreferenceRepository`, não `IUserPreferenceRepository`.
- **Repositories concretos prefixados com o adaptador** — ex: `DrizzleUserPreferenceRepository` implementa `UserPreferenceRepository`.
- **shadcn/ui é a biblioteca de componentes padrão** — usar `bunx --bun shadcn@latest add <component>` antes de construir primitivos do zero. A flag `--bun` é obrigatória com Bun runtime.
- **Componentes UI (`components/ui/`)** são shadcn/ui primitivos, puramente visuais: sem `useState` de negócio, sem `fetch`.
- **NUNCA usar elementos HTML crus** (`<button>`, `<input>`, `<select>`, etc.) quando existe componente equivalente em `components/ui/`. Usar `<Button>`, `<Input>`, `<Select>`, etc.
- **Páginas autenticadas DEVEM usar componentes de layout** — `<PageContainer>`, `<PageHeader>`, `<PageTitle>`, `<PageDescription>` de `components/layout/page-container.tsx`.
- **Dark mode obrigatório** — todo componente DEVE funcionar em modo claro e escuro. Usar tokens semânticos do Tailwind (`bg-background`, `text-foreground`). NUNCA cores hardcoded que não se adaptam ao tema.
- **Arquivo `design.pen`** — consultar via Pencil MCP antes de construir qualquer tela nova como referência visual.
- **`use client` apenas quando necessário** — Server Components são o padrão.
- **Data fetching** usa Server Components com `async/await`; `useEffect` para fetch é proibido.

### Banco de dados

- **Valores financeiros**: `numeric(10,2)` — `float` e `double` são proibidos.
- **Todo foreign key deve ter índice** correspondente.
- **`SELECT *` é proibido** em código de produção.
- **Transações obrigatórias** para operações que afetam múltiplas tabelas.
- **Migrations devem ser reversíveis.**
- **Drizzle ORM**: usar `generate` + `migrate` — `drizzle-kit push` é proibido.

### API REST

- URLs em plural, kebab-case: `/api/v1/books/:id/chapters`
- Status codes corretos: `201` para POST, `204` para DELETE, `422` para dados inválidos, `409` para conflito de estado.
- **Nunca retornar `200` com `{ success: false }`.**
- Input validado com **Zod** em todas as rotas.
- Stack traces e mensagens de SQL **nunca** aparecem em respostas de erro.

### Anti-padrões proibidos

- `any` em TypeScript sem comentário justificando.
- Segredos hardcoded — usar variáveis de ambiente.
- `console.log` em produção — usar structured logger.
- `useEffect` para derivar estado — usar `useMemo`.
- Valores visuais hardcoded (cores, espaçamentos) fora de design tokens.
- Elementos HTML crus (`<button>`, `<input>`, etc.) quando existe componente em `components/ui/`.
- Página autenticada sem `<PageContainer>` e componentes de layout.
- Ignorar dark mode — cores que não se adaptam ao tema.
- Lógica de negócio em controllers.
- SQL direto fora de repositories.
- Swallow silencioso de erros: `catch (e) {}`.
- Mutação de objetos recebidos como parâmetro — sempre retornar novo objeto.
- `drizzle-kit push` — usar `generate` + `migrate` para manter journal sincronizado.

---

## TDD (obrigatório)

1. Escreva o teste primeiro (RED).
2. Implemente o mínimo para passar (GREEN).
3. Refatore (IMPROVE).
4. Cobertura mínima: **80%** geral; **100%** para lógica de cálculo de ganho.

---

## Regras de Classificação de Testes

### Unit (`__tests__/unit/`)

Testa **uma única unidade** (função, classe, módulo) **isolada** de dependências externas.

| Critério | Regra |
|----------|-------|
| Dependências externas | **Todas mockadas** (DB, HTTP, filesystem, crypto) |
| Banco de dados | **Proibido** — nenhuma conexão real |
| Setup file | Nenhum (não usa `setup.ts` de integration) |
| Velocidade | < 50ms por teste |
| O que testar | Schemas Zod, funções puras, validações, state machines, config assertions, middleware com deps mockadas |

**Regra de ouro:** Se o teste usa `vi.mock()` para isolar a unidade → é unit test.

### Integration (`__tests__/integration/`)

Testa a **interação entre 2+ componentes reais**, especialmente com banco de dados.

| Critério | Regra |
|----------|-------|
| Dependências externas | **Pelo menos uma real** (DB, crypto lib, auth lib) |
| Banco de dados | **Real** (PostgreSQL via transaction rollback) |
| Setup file | Usa `__tests__/integration/setup.ts` |
| Isolamento | Transaction rollback automático entre testes |
| O que testar | CRUD no banco, password hashing + persistência, sessões reais, regras de negócio que tocam o DB, cascade deletes, constraints |

**Regra de ouro:** Se o teste precisa de DB real ou integra múltiplos módulos sem mock → é integration test.

### E2E (`__tests__/e2e/`)

Testa **fluxos completos do usuário** pela interface, sem mocks.

| Critério | Regra |
|----------|-------|
| Ferramenta | **Playwright** (browser real) |
| Mocks | **Nenhum** — tudo real (app rodando, DB, auth) |
| Servidor | App Next.js rodando (dev ou build) |
| O que testar | Login completo no browser, navegação protegida, formulários, feedback visual, fluxos críticos ponta-a-ponta |

**Regra de ouro:** Se o teste simula ações de um usuário real no browser → é E2E test.

### Decisão rápida

```
O teste usa vi.mock(), fakes injetados ou testa função pura?  → Unit
O teste conecta no banco ou integra módulos?                  → Integration
O teste abre browser e simula usuário?                        → E2E
```

### Convenção de Test Doubles

#### Quando usar fakes manuais (injeção de dependência)

Para módulos internos do projeto (`@/lib/`, `@/app/`, etc.), **não usar `vi.mock()`**. Em vez disso:

1. **Repository fake (classe)**: Quando um service depende de uma interface de repository via construtor.
   - Modelo: `__tests__/repositories/in-memory-user-preference-repository.ts` → `UserPreferenceService`
2. **Fake de função (`vi.fn()`)**: Quando um módulo aceita dependência como parâmetro de função.
   - Modelo: `__tests__/unit/db/health-check.test.ts` → `checkDatabaseHealth(ping)`
   - Modelo: `__tests__/unit/api/health.test.ts` → `handleHealthCheck(deps)`
   - Modelo: `__tests__/unit/db/instrumentation.test.ts` → `runStartupHealthCheck(deps)`

#### Quando `vi.mock()` é aceitável (allowlist)

`vi.mock()` é permitido **apenas** para módulos que não são injetáveis por design:

| Módulo | Categoria |
|--------|-----------|
| `next/headers` | Framework externo (Next.js) |
| `next/navigation` | Framework externo (Next.js) |
| `@axe-core/playwright` | Biblioteca externa |
| `better-auth/cookies` | Biblioteca externa |
| `@/lib/env` | Infraestrutura de ambiente (singleton) |
| `@/lib/db` | Infraestrutura de I/O (singleton PostgreSQL) |

Os mocks globais de `@/lib/db` e `@/lib/env` ficam em `__tests__/unit/setup.ts`.

#### `vi.fn()` é livre

`vi.fn()` pode ser usado livremente para criar fakes tipados — não exige classes hand-written para funções simples. Exemplo:

```
const checkConnection = vi.fn().mockResolvedValue({ healthy: true });
```

---

## Skills obrigatórias

**Workflow:** `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-implement`, `/speckit-analyze`, `/conventional-commits`, `/finish-task`, `/tdd`, `/code-review`, `/simplify`, `/e2e`

**Referência:** `/shadcn`, `/docs` (Context7 MCP), `/api-design`, `/backend-patterns`, `/postgres-patterns`, `/frontend-patterns`, `/frontend-design`, `/vercel-composition-patterns`, `/ui-ux-pro-max`

- **Context7 MCP obrigatório** — antes de usar qualquer API de lib (Next.js, React, Drizzle, Zod, shadcn, Tailwind, Playwright, etc.), consultar docs via Context7 (`resolve-library-id` + `query-docs`).

---

## Verificação de qualidade (obrigatório por fase)

- **SEMPRE usar scripts do `package.json`**, nunca comandos diretos:
  - `bun run lint` (não `bunx biome check .`)
  - `bun run test:unit` (não `bun vitest run __tests__/unit/`)
  - `bun run test:integration` (não `bun vitest run __tests__/integration/`)
  - `bun run test:e2e` (não `bunx playwright test`)
  - `bun run build` (não `next build`)
- Nenhuma fase é concluída com erros ou warnings de lint.
- Nenhuma fase é concluída com testes falhando.
- Build DEVE passar antes de criar PR.

---

## Branch principal

- A branch principal é `main`.
- Todos os PRs DEVEM ser abertos contra `main`.

---

## Self-Review antes de qualquer entrega

```
- [ ] I.    Operações no nível do capítulo?
- [ ] II.   Cálculos financeiros determinísticos e auditáveis?
- [ ] III.  Transições de status validadas, com data e responsável?
- [ ] IV.   Complexidade justificada por requisito concreto?
- [ ] V.    Testes escritos ANTES da implementação, cobertura ≥ 80%?
- [ ] VI.   Lógica de negócio no Service/Domain, não no Controller?
- [ ] VII.  Componentes UI puramente visuais? Usando components/ui/ (não HTML cru)?
- [ ] VII.  PageContainer e layout components em páginas autenticadas?
- [ ] VII.  Dark mode funciona em todos os componentes novos?
- [ ] VIII. Sem peso desnecessário no bundle do cliente?
- [ ] IX.   Valores visuais via design tokens (sem hardcode)?
- [ ] X.    Endpoints REST corretos (URL, método, status, envelope, Zod)?
- [ ] XI.   Sem SELECT *? Foreign keys com índice? Monetário em numeric?
- [ ] XII.  Nenhum anti-padrão proibido presente?
- [ ] XV.   Context7 MCP consultado? design.pen referenciado para telas?
- [ ] XVI.  bun run lint, testes e build passando sem erros/warnings?
```

---

## Modelo de domínio (resumo)

| Entidade   | Pertence a | Campo crítico                        |
|------------|------------|--------------------------------------|
| Estúdio    | —          | nome                                 |
| Livro      | Estúdio    | `preço_por_hora` (imutável quando `pago`), `pdf_url` (opcional) |
| Capítulo   | Livro      | status, narrador, editor, horas_editadas, num_paginas |
| Narrador   | —          | responsável pela gravação dos capítulos    |
| Editor     | —          | recebe pagamento por horas em capítulos atribuídos |

Sem entidades órfãs: capítulo sem livro ou livro sem estúdio são inválidos.

---

## Workflow de desenvolvimento

1. Feature começa com `spec.md` aprovada (`/speckit-specify`).
2. `plan.md` com decisões de arquitetura antes de codar (`/speckit-plan`). Consultar `design.pen` via Pencil MCP.
3. Consultar docs de libs via Context7 MCP antes de implementar.
4. TDD (ver acima) — usar `/tdd`.
5. Verificação de qualidade após cada fase: `bun run lint`, `bun run test:unit`, `bun run build`.
6. Code review verificando conformidade com os Princípios I–XVI (`/code-review`).
7. Commits convencionais: `feat:`, `fix:`, `refactor:`, `test:`, `docs:` (`/conventional-commits`).
8. Finalização: `/finish-task` para criar PR contra `main`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) requer **revisão dupla** antes do merge.

**Idioma dos artefatos**: Nos artefatos do speckit, títulos e textos em negrito dos templates permanecem em **inglês**; o conteúdo descritivo (placeholders preenchidos) DEVE ser em **português brasileiro**. Termos técnicos em inglês podem ser mantidos. Commits e branches permanecem em inglês.


## Recent Changes
- 015-narrators-crud: Added TypeScript 5.9.3 (Bun runtime 1.x) + Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.0 + `@hookform/resolvers` 5.2.2, shadcn/ui 4.1.2, `@tanstack/react-table` (nova dependência), Tailwind CSS 4.2, lucide-react 1.7.0, sonner 2.0.7
- 014-custom-404-page: Added TypeScript 5.9.3 (Bun runtime) + Next.js 16.2.1 (App Router), React 19.2.4, Tailwind CSS v4, shadcn/ui 4.1.2, lucide-react 1.7.0
- 013-mobile-sidebar-menu: Added TypeScript 5.9.3 (Bun runtime) + Next.js 16.2.1 (App Router), React 19.2.4, Tailwind CSS v4, lucide-react 1.7.0, shadcn/ui 4.1.2

## Active Technologies
- TypeScript 5.9.3 (Bun runtime 1.x) + Next.js 16.2.1 (App Router), React 19.2.4, Drizzle ORM 0.45.2, Zod 4.3.6, better-auth 1.5.6, React Hook Form 7.72.0 + `@hookform/resolvers` 5.2.2, shadcn/ui 4.1.2, `@tanstack/react-table` (nova dependência), Tailwind CSS 4.2, lucide-react 1.7.0, sonner 2.0.7 (015-narrators-crud)
- PostgreSQL via Drizzle ORM (nova tabela `narrator`) (015-narrators-crud)
