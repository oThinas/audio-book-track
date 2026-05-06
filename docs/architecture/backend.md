# Arquitetura — Backend

> Visão geral das camadas do backend (Next.js Route Handlers + Drizzle ORM + PostgreSQL). Para regras detalhadas, ver Princípio VI da [constituição](../../.specify/memory/constitution.md).

## Princípios

- **Camadas com dependência unidirecional**: HTTP → Factory → Service → Repository → Domain. Cada camada pode chamar a de baixo, nunca a de cima.
- **Injeção de dependência via construtor**: services nunca instanciam suas próprias dependências; recebem-nas no construtor (factories montam o grafo).
- **Domain sem persistência**: `lib/domain/` contém entidades, value objects, enums e regras puras — livre de qualquer port de persistência.
- **Sem `SELECT *`** — repositories projetam colunas explicitamente.

## Camadas

```
src/app/api/v1/<resource>/route.ts        ← Controllers (HTTP)
              ↓ usa
src/lib/factories/<entity>.ts             ← Composition root (createXService)
              ↓ instancia
src/lib/services/<entity>-service.ts      ← Use cases (orquestração)
              ↓ depende de port
src/lib/repositories/<entity>-repository.ts (interface)
   └ src/lib/repositories/drizzle/Drizzle<Entity>Repository.ts (adapter)
              ↓ usa
src/lib/db/schema/                        ← Drizzle schema + migrations journal
src/lib/domain/<entity>.ts                ← Entidades, VOs, enums, regras puras
src/lib/errors/<entity>-errors.ts         ← Erros tipados de domínio
src/lib/schemas/<entity>.ts               ← Zod input schemas (HTTP boundary)
src/lib/api/responses.ts                  ← Helpers de resposta padronizada
```

### Controllers (`src/app/api/v1/<resource>/route.ts`)

- **Responsabilidade única**: parse + validação Zod, autenticação, chamada ao service via factory, mapeamento de erros tipados → resposta HTTP.
- **Não contêm lógica de negócio**, **não fazem SQL direto**, **não instanciam services manualmente** (sempre via `createXService()`).
- Usam helpers de `src/lib/api/responses.ts` (`unauthorizedResponse`, `validationErrorResponse`, `conflictResponse`, `notFoundResponse`) para envelopes consistentes.
- Validação de input com Zod schemas em `src/lib/schemas/`.

### Factories (`src/lib/factories/<entity>.ts`)

- **Composition root**: amarra o adapter Drizzle ao service. Função pública `create<Entity>Service()` retorna o service com todas as deps injetadas.
- Pode incluir helpers para deps específicas (ex.: `createGetActiveBooks()`, `createStudioSoftDeleteDeps()` em `factories/studio.ts`).
- Controllers consomem **apenas** factories — nunca importam `DrizzleXRepository` diretamente.

### Services (`src/lib/services/<entity>-service.ts`)

- **Use cases**: orquestram repositories, aplicam regras de negócio que cruzam entidades, lidam com transações via `UnitOfWork`.
- Recebem dependências (repository, deps opcionais) no construtor.
- Lançam erros tipados de `lib/errors/` em vez de retornar `null`/`{ ok: false }`.
- **Sem SQL direto, sem `fetch`, sem HTTP** — tudo via repositories.

Exemplo de operação atômica (criar livro + capítulos + estúdio inline):
`BookService.create({ inline })` envolve a operação inteira em
`SavepointUnitOfWork`, garantindo `BEGIN/COMMIT` único.

### Repositories — Ports e Adapters

- **Port (interface)**: `src/lib/repositories/<entity>-repository.ts` — define operações em termos de domínio (ex.: `findById`, `findAllWithCounts`, `softDelete`).
- **Adapter (implementação)**: `src/lib/repositories/drizzle/Drizzle<Entity>Repository.ts` — única classe que faz SQL via Drizzle.
- **Sem prefixo `I`**: `StudioRepository` (port), não `IStudioRepository`.
- **Listagens com derived columns**: `findAllWithCounts()` usa `LEFT JOIN + GROUP BY` em uma única query — não criar rota `/counts` separada.
- **Soft-delete**: entidades soft-deletáveis (`studio`, `narrator`, `editor`) listam por `deleted_at IS NULL`, têm índice único parcial sobre o nome quando vivo, e suportam **desarquive automático por colisão de nome** (mesmo `id` reativado).

### Domain (`src/lib/domain/`)

- Entidades, value objects, enums (`ChapterStatus`, `BookStatus`), state machines (`chapter-state-machine.ts`), regras puras (`earnings.ts`, `chapter-transitions.ts`).
- **Não importa nada de `lib/repositories/`, `lib/services/` ou `lib/db/`**.
- Cobertura de testes: 100% em lógica de cálculo financeiro (`earnings.ts`, `chapter-transitions.ts`).

### Schema do banco (`src/lib/db/schema/`)

- Um arquivo por tabela, índices declarados junto à tabela, relations em `relations.ts`.
- Migrations geradas via `drizzle-kit generate` + aplicadas via `migrate`. **Nunca** `drizzle-kit push`.
- Valores monetários em **`integer` cents** (sufixo `_cents`); durações financeiras em **`integer` segundos** (`_seconds`). `float`/`double` proibidos.

## Padrões transversais

### Transações via UnitOfWork

Operações que afetam múltiplas tabelas usam `SavepointUnitOfWork` para encapsular `BEGIN/COMMIT` no service. Exemplos:

- `BookService.create({ inline })` cria estúdio + livro + capítulos atomicamente.
- Deletar capítulo + recomputar `book.status` é uma única transação.

`book.status` é **cache materializado** recomputado por `BookStatusRecomputeService` na **mesma transação** de qualquer mutação de capítulo. A fonte da verdade é o capítulo (Princípio I).

### Erros tipados

Cada feature define erros em `lib/errors/<entity>-errors.ts` (ex.: `StudioHasActiveBooksError`, `ChapterPaidLockedError`). O controller faz `instanceof` matching e mapeia para o status HTTP correto via `conflictResponse`/`validationErrorResponse`.

### Cálculo de ganho (determinístico, auditável)

```
ganho_centavos = round(chapter.edited_seconds × book.price_per_hour_cents / 3600)
```

- Arredondamento half-away-from-zero.
- Resultado em centavos (integer); conversão para BRL fica na camada de apresentação (UI).
- Implementado em `src/lib/domain/earnings.ts` com cobertura 100%.

## Localização

| Tipo | Diretório | Importação |
|---|---|---|
| Controllers HTTP | `src/app/api/v1/<resource>/route.ts` | (Next.js Route Handler) |
| Factories | `src/lib/factories/<entity>.ts` | `@/lib/factories/<entity>` |
| Services | `src/lib/services/<entity>-service.ts` | `@/lib/services/<entity>-service` |
| Repository ports | `src/lib/repositories/<entity>-repository.ts` | `@/lib/repositories/<entity>-repository` |
| Repository adapters | `src/lib/repositories/drizzle/` | `@/lib/repositories/drizzle/...` |
| UnitOfWork | `src/lib/repositories/unit-of-work.ts` (port) + `drizzle/drizzle-unit-of-work.ts` (adapter) | idem |
| Domain | `src/lib/domain/<entity>.ts` | `@/lib/domain/<entity>` |
| Erros tipados | `src/lib/errors/<entity>-errors.ts` | `@/lib/errors/<entity>-errors` |
| Zod schemas (HTTP input) | `src/lib/schemas/<entity>.ts` | `@/lib/schemas/<entity>` |
| Helpers de resposta | `src/lib/api/responses.ts` | `@/lib/api/responses` |
| DB schema | `src/lib/db/schema/<entity>.ts` | `@/lib/db/schema` (re-export central) |

## Anti-padrões proibidos

- Lógica de negócio em controllers/route handlers.
- SQL direto fora de repositories.
- Controller instanciando `DrizzleXRepository` ou `XService` diretamente — sempre usar a factory.
- Interface de repositório co-localizada com implementação ou em `lib/domain/` — port mora em `lib/repositories/<entity>-repository.ts`.
- Prefixo `I` em interfaces (`IStudioRepository` ❌ → `StudioRepository` ✅).
- `SELECT *` em queries de produção.
- Foreign keys sem índice.
- `drizzle-kit push` — usa `generate` + `migrate` para manter o journal sincronizado.
- `float`/`double` para valores financeiros — sempre `integer` em centavos.
- `ON DELETE SET NULL` em FKs de entidades soft-deletáveis — todas usam `RESTRICT` + soft-delete.
- Mutar objetos recebidos como parâmetro — sempre retornar novo objeto.
- Swallow silencioso de erros (`catch (e) {}`).
- `console.log` em produção — usar structured logger.

## Referências

- [.specify/memory/constitution.md](../../.specify/memory/constitution.md) — Princípio VI (Arquitetura Limpa no Backend), VIII (DB), X (REST), XI (PostgreSQL), XII (Anti-Padrões)
- [docs/testing-strategy.md](../testing-strategy.md) — isolamento de testes integration/E2E
- [docs/architecture/frontend.md](./frontend.md) — espelho do frontend