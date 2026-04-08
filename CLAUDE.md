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
O teste usa vi.mock() ou testa função pura?     → Unit
O teste conecta no banco ou integra módulos?     → Integration
O teste abre browser e simula usuário?           → E2E
```

---

## Self-Review antes de qualquer entrega

```
- [ ] I.   Operações no nível do capítulo?
- [ ] II.  Cálculos financeiros determinísticos e auditáveis?
- [ ] III. Transições de status validadas, com data e responsável?
- [ ] IV.  Complexidade justificada por requisito concreto?
- [ ] V.   Testes escritos ANTES da implementação, cobertura ≥ 80%?
- [ ] VI.  Lógica de negócio no Service/Domain, não no Controller?
- [ ] VII. Componentes UI puramente visuais?
- [ ] VIII.Sem peso desnecessário no bundle do cliente?
- [ ] IX.  Valores visuais via design tokens (sem hardcode)?
- [ ] X.   Endpoints REST corretos (URL, método, status, envelope, Zod)?
- [ ] XI.  Sem SELECT *? Foreign keys com índice? Monetário em numeric?
- [ ] XII. Nenhum anti-padrão proibido presente?
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

1. Feature começa com `spec.md` aprovada.
2. `plan.md` com decisões de arquitetura antes de codar.
3. TDD (ver acima).
4. Code review verificando conformidade com os Princípios I–XII.
5. Commits convencionais: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`.

Qualquer mudança no modelo financeiro (preço, horas, responsáveis) requer **revisão dupla** antes do merge.


## Recent Changes
- 006-ui-polish-favorites: Added TypeScript 5.9, Bun runtime + Next.js 16.2, React 19.2, better-auth 1.5, @base-ui/react 1.3, next-themes 0.4, Tailwind CSS 4.2, Drizzle ORM 0.45, Zod 4.3, lucide-react 1.7
- 005-shadcn-base-ui: Added TypeScript 5.9 (Bun runtime) + Next.js 16.2, React 19.2, shadcn v4.1.2, radix-ui v1.4.3 (a ser substituido por @base-ui-components/react)
- 004-test-review-e2e: Added TypeScript 5.9 (Bun runtime) + Next.js 16.2, better-auth 1.5, Drizzle ORM, Playwright (novo)

## Active Technologies
- TypeScript 5.9, Bun runtime + Next.js 16.2, React 19.2, better-auth 1.5, @base-ui/react 1.3, next-themes 0.4, Tailwind CSS 4.2, Drizzle ORM 0.45, Zod 4.3, lucide-react 1.7 (006-ui-polish-favorites)
- PostgreSQL (Neon serverless) via Drizzle ORM (006-ui-polish-favorites)
