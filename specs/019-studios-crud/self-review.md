# Self-Review: 019 Studios CRUD

**Data**: 2026-04-22
**Feature**: CRUD de Estúdios
**Branch**: `019-studios-crud`

Checklist mapeia cada princípio da constituição (v2.11.0) a evidências concretas na feature.

## I. Operações no nível do capítulo

**N/A** — feature é puramente CRUD de entidade raiz (`Studio`). Não toca em capítulos, livros, cálculo de ganho ou transições de status.

## II. Cálculos financeiros determinísticos e auditáveis

`defaultHourlyRate` é armazenado em [schema.ts](../../src/lib/db/schema.ts) como `numeric(10, 2)` (nunca `float`). A conversão `string ↔ number` acontece apenas na borda do repository em [drizzle-studio-repository.ts](../../src/lib/repositories/drizzle/drizzle-studio-repository.ts) (`toDomain()` + `toFixed(2)` no insert), mantendo precisão exata nos ±9999.99 do range. **Nada é recalculado a partir deste valor** — o campo serve apenas como default para a futura criação de Livros. O Princípio II continua preservado para a feature de Livros, que copiará o preço para cada livro criado e o tornará imutável quando o livro estiver pago.

## III. Transições de status

**N/A** — `Studio` não tem campo de status.

## IV. Complexidade justificada

- `MoneyInput` ([money-input.tsx](../../src/components/ui/money-input.tsx)) implementa cents-first do zero (~110 linhas) em vez de adicionar `react-imask` ou `react-number-format`. Decisão documentada em [research.md §R1](./research.md).
- Helpers `getUniqueConstraintName` / `extractConstraint` duplicados de `DrizzleEditorRepository` em vez de extrair para `lib/db/postgres-errors.ts` — extração adiada até o 3º consumidor (Livros) conforme YAGNI ([research.md §R3](./research.md)).

## V. TDD + cobertura ≥ 80%

**Todos os testes foram escritos antes da implementação.** Evidência: cada phase seguiu o ciclo Red → Green → Refactor, com execução explícita antes de implementar (verificada em `bun run test:unit` falhando após T009/T013/T017/T024/T030/T035 e passando após T011/T014/T019/T027/T032/T037).

Cobertura por camada (após Phase 7):

| Camada | Arquivo | Testes |
|---|---|---|
| Domain schema | `__tests__/unit/domain/studio-schema.spec.ts` | 22 |
| Repository (DB real) | `__tests__/integration/repositories/drizzle-studio-repository.spec.ts` | 21 |
| Service | `__tests__/unit/services/studio-service.spec.ts` | 13 |
| API list | `__tests__/unit/api/studios-list.spec.ts` | 4 |
| API create | `__tests__/unit/api/studios-create.spec.ts` | 10 |
| API update | `__tests__/unit/api/studios-update.spec.ts` | 10 |
| API delete | `__tests__/unit/api/studios-delete.spec.ts` | 3 |
| Component | `__tests__/unit/components/money-input.spec.tsx` | 19 |
| E2E | 9 specs (list/create/update/delete + polish) | — |

Classificação por tipo (unit/integration/e2e) está correta — nenhum integration usa mocks, nenhum unit toca DB.

## VI. Clean Architecture

Dependências fluem de fora para dentro, sem atalhos:

- **Controllers**: [route.ts](../../src/app/api/v1/studios/route.ts) + [\[id\]/route.ts](../../src/app/api/v1/studios/[id]/route.ts) — apenas session guard, Zod parse, factory, error mapping.
- **Factory**: [lib/factories/studio.ts](../../src/lib/factories/studio.ts) — único ponto que injeta dependências concretas no service.
- **Service**: [studio-service.ts](../../src/lib/services/studio-service.ts) — recebe `StudioRepository` via construtor; faz apenas `trim()` no name.
- **Repository**: [drizzle-studio-repository.ts](../../src/lib/repositories/drizzle/drizzle-studio-repository.ts) implementa a interface definida em `domain/`.
- **Domain**: [studio.ts](../../src/lib/domain/studio.ts) + [studio-repository.ts](../../src/lib/domain/studio-repository.ts) + [studio-errors.ts](../../src/lib/errors/studio-errors.ts) — puramente contratos, sem dependências de infra.

Controllers nunca tocam SQL, sem prefixo `I` em interfaces, repositories concretos prefixados (`DrizzleStudioRepository`).

## VII. Frontend

- **shadcn/ui primitivos** são usados em todos os lugares onde existem: `Button`, `Input`, `Label`, `Table*`, `AlertDialog*`, `ScrollArea`, `Toaster` (sonner). `MoneyInput` foi criado em `components/ui/` porque é um primitivo reutilizável (não existe equivalente shadcn nativo).
- **Componentes de feature** em [src/components/features/studios/](../../src/components/features/studios/) — nunca dentro de `src/app/`.
- **Nenhum elemento HTML cru** em lugar de componente UI.
- **`<PageContainer>` + layout components** em [studios/page.tsx](../../src/app/(authenticated)/studios/page.tsx).
- **`use client` mínimo** — Server Component na page.tsx; `use client` só em Studios-Client/Table/Row/NewRow/MoneyInput/DeleteDialog onde há estado ou event handlers.
- **Dark mode** via tokens semânticos (`bg-background`, `text-foreground`, `text-destructive`, `border-input`, etc.) — sem cores hardcoded. Validado pelo spec `studios-dark-mode.spec.ts`.
- **Mobile first**: `MoneyInput` usa `inputMode="numeric"` para teclado numérico em mobile; responsive spec cobre 375/768/1440.

## VIII. Bundle

MoneyInput é um componente pequeno, sem libs externas. Usa apenas APIs browser-native (`Intl.NumberFormat`, `InputEvent`, `ClipboardEvent`). Não virou peso desnecessário no bundle.

## IX. Design tokens

Todos os valores visuais usam tokens Tailwind do design system (`bg-destructive`, `text-primary`, `border-input`, `bg-background`, etc.). Nenhum hex, rgb ou px hardcoded no CSS dos componentes novos. Validado pelo spec `studios-primary-colors.spec.ts` que alterna 5 variantes e confirma que `--primary` ≠ `--destructive` em todas.

## X. API REST

- URLs em plural kebab-case: `/api/v1/studios`, `/api/v1/studios/:id`
- Status codes: `200` (list/update), `201` (create com Location), `204` (delete), `401`, `404`, `409`, `422`
- Envelope `{ data }` em todas as respostas de sucesso; envelope `{ error: { code, message, details? } }` em erros
- Input validado com Zod via `createStudioSchema`/`updateStudioSchema`
- Nunca retorna `200` com `{ success: false }`
- Mensagens de erro em português, sem stack traces nem detalhes de SQL vazando

## XI. Banco de dados

- `default_hourly_rate` como `numeric(10, 2)` (nunca `float`)
- Índice único `studio_name_unique` em `name` (único FK análogo — studio não tem FKs entrantes ou saintes nesta feature)
- Sem `SELECT *`: queries usam `STUDIO_COLUMNS` explícito em `drizzle-studio-repository.ts`
- Operações de escrita single-row (create/update/delete) não exigem transação
- Migração `drizzle/0005_sad_landau.sql` reversível (tem `DROP TABLE` simétrico possível)
- `bun run db:generate` + `bun run db:migrate` usados (não `drizzle-kit push`)

## XII. Anti-padrões proibidos

- ❌ `any` sem justificativa — inexistente
- ❌ Segredos hardcoded — inexistente
- ❌ `console.log` — inexistente
- ❌ `useEffect` para derivar estado — inexistente (usamos `useMemo` para `sortedStudios` e `displayValue`)
- ❌ Valores visuais hardcoded — inexistente
- ❌ Elementos HTML crus quando há `components/ui/` — inexistente
- ❌ Pasta `_components/` em `src/app/` — inexistente
- ❌ Page autenticada sem `PageContainer` — inexistente
- ❌ Dark mode quebrado — validado por spec
- ❌ Lógica de negócio em controllers — inexistente
- ❌ SQL direto fora de repositories — inexistente
- ❌ `catch (e) {}` silencioso — inexistente (handlers expõem `toast` ou rethrow)
- ❌ Mutação de parâmetros — inexistente (service usa `{ ...input, name: input.name.trim() }`)
- ❌ `drizzle-kit push` — inexistente

## XV. Context7 MCP + design.pen

- **Context7**: consultado em T002 para React 19 `onBeforeInput`, Drizzle `numeric`, e `Intl.NumberFormat`. Decisão de usar native `addEventListener` em vez de synthetic `onBeforeInput` registrada em [money-input.tsx:46-50](../../src/components/ui/money-input.tsx#L46-L50) após validação empírica de que o synthetic não dispara em jsdom.
- **design.pen**: consultado em T001 (Node `rkZ68`, frame "06 - Estúdios"). Tokens de cor, tipografia e espaçamentos validados; nenhuma divergência registrada em relação ao spec.

## XVI. Fase final de verificação

Será executada em T048–T052 (Final Quality Gate) antes da abertura do PR contra `main`:

- `bun run lint` — zero erros e zero warnings
- `bun run test:unit` — toda a suíte passando
- `bun run test:integration` — toda a suíte passando
- `bun run test:e2e` — toda a suíte passando (incluindo os 8 specs novos de Polish)
- `bun run build` — build de produção compila

---

**Resultado**: Todos os princípios aplicáveis estão atendidos com evidência concreta nesta feature.
