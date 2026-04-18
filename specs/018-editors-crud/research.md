# Research: CRUD de Editores

**Feature**: 018-editors-crud
**Date**: 2026-04-17
**Status**: Complete — zero `NEEDS CLARIFICATION` pendentes

## Escopo

Feature aditiva que espelha a estrutura atual de Narrador (pós-017) e adiciona o campo `email` com a constraint de unicidade correspondente. Todas as libs, padrões arquiteturais e convenções já estão em uso no projeto — nenhuma pesquisa nova sobre tooling foi necessária. Esta página existe para ancorar decisões de design específicas da feature.

---

## R1 — Forma da tabela Drizzle (aditiva, 2 índices únicos)

**Decisão**: Declarar a tabela `editor` em `src/lib/db/schema.ts` imediatamente após `narrator`, com estrutura idêntica mais a coluna `email`:

```ts
export const editor = pgTable(
  "editor",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("editor_name_unique").on(table.name),
    uniqueIndex("editor_email_unique").on(table.email),
  ],
);
```

Gerar migração com `bun run db:generate` — a SQL esperada é:

```sql
CREATE TABLE "editor" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "editor_name_unique" ON "editor" ("name");
CREATE UNIQUE INDEX "editor_email_unique" ON "editor" ("email");
```

Aplicar com `bun run db:migrate`.

**Rationale**:
- Projeto proíbe `drizzle-kit push` (Princípio XI). `generate` + `migrate` mantém o journal sincronizado.
- A tabela é nova e vazia na criação — `CREATE UNIQUE INDEX` não pode falhar por dados pré-existentes.
- Dois `uniqueIndex` separados em vez de um composto: as constraints são independentes. Um nome duplicado não implica email duplicado e vice-versa; o banco precisa enforcar cada uma isoladamente.

**Alternativas consideradas**:
- *Uma única constraint composta `(name, email)`*: rejeitado — permitiria `(João, a@b.com)` e `(João, c@d.com)` coexistirem, violando FR-014.
- *Constraint `unique` via `$type`/`check`*: rejeitado — `uniqueIndex` é a forma idiomática do Drizzle e gera `CREATE UNIQUE INDEX` direto; `check` não garante unicidade.
- *Coluna `email` com `lower(email)` via expressão funcional no índice*: rejeitado — Drizzle não tem suporte nativo simples a expressões funcionais em `uniqueIndex` neste momento, e a normalização no service (R6) resolve o mesmo problema com menos código.

---

## R2 — Normalização de e-mail no service

**Decisão**: Normalizar e-mail (`trim()` + `toLowerCase()`) no **`EditorService`** antes de chamar o repository — em `create` e em `update` (quando `email` presente).

```ts
async create(input: CreateEditorInput): Promise<Editor> {
  return this.repository.create({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
  });
}

async update(id: string, input: UpdateEditorInput): Promise<Editor> {
  return this.repository.update(id, {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
  });
}
```

A coluna `email` armazena sempre o valor **já normalizado**. O índice único aplica-se a esse valor normalizado — simples, sem expressão funcional.

**Rationale**:
- Centraliza a regra de negócio (domain policy) no service, onde ela pertence.
- Mantém o schema Drizzle e a migração SQL triviais.
- A consulta `findByEmail("Carla@Studio.com")` feita pelo service funciona porque o service também normaliza o input antes de passar ao repo.
- O Zod schema aplica `.trim()` automaticamente; a responsabilidade de `.toLowerCase()` fica explicitamente no service — o cliente pode enviar capitalização arbitrária e o sistema trata como equivalente.

**Alternativas consideradas**:
- *Normalizar no Zod via `.transform()`*: aceitável, mas prende a lógica ao layer de validação HTTP e não protege chamadas programáticas ao service (ex: futuros seeders, importadores). Service-layer normalization é mais robusto.
- *Normalizar no repository*: rejeitado — repo deve ser persistência pura, sem regras de negócio.
- *Expressão funcional `lower(email)` no índice + comparação `ilike`*: rejeitado como mais complexo e específico de SQL; escolhido só se futuramente houver necessidade de preservar o casing original para exibição (não é o caso aqui).

---

## R3 — Mapeamento de unique violation para classe de erro específica

**Decisão**: No `DrizzleEditorRepository`, os blocos `try/catch` em `create` e `update` precisam distinguir **qual** constraint foi violada para lançar o erro correto (`EditorNameAlreadyInUseError` vs `EditorEmailAlreadyInUseError`). A decisão é inspecionar a propriedade `constraint` (ou `constraint_name`) do erro do PostgreSQL:

```ts
const POSTGRES_UNIQUE_VIOLATION = "23505";
const EDITOR_NAME_CONSTRAINT = "editor_name_unique";
const EDITOR_EMAIL_CONSTRAINT = "editor_email_unique";

function getUniqueConstraintName(error: unknown): string | null {
  const direct = (error as { code?: unknown; constraint?: unknown })?.code === POSTGRES_UNIQUE_VIOLATION
    ? (error as { constraint?: unknown }).constraint
    : null;
  if (typeof direct === "string") return direct;

  if (error instanceof Error && error.cause) {
    const cause = error.cause as { code?: unknown; constraint?: unknown };
    if (cause.code === POSTGRES_UNIQUE_VIOLATION && typeof cause.constraint === "string") {
      return cause.constraint;
    }
  }
  return null;
}
```

No `catch`:

```ts
const constraint = getUniqueConstraintName(error);
if (constraint === EDITOR_NAME_CONSTRAINT) {
  throw new EditorNameAlreadyInUseError(input.name);
}
if (constraint === EDITOR_EMAIL_CONSTRAINT) {
  throw new EditorEmailAlreadyInUseError(input.email);
}
throw error;
```

**Rationale**:
- `node-postgres` expõe `err.constraint` com o nome do índice violado quando `err.code === "23505"`. Esta é a forma idiomática de distinguir qual unicidade foi quebrada.
- Fallback `throw error` preserva qualquer outra violação não mapeada.
- Testes de integration verificam que o constraint name bate com o esperado — se o Drizzle renomear índices em versão futura, o teste quebra e a constante é atualizada.

**Alternativas consideradas**:
- *Pré-validação via `findByName` + `findByEmail` no service*: rejeitado — race condition clássica (dois requests concorrentes passam a checagem, ambos inserem, um falha no DB, vira `500`). Constraint + catch é a defesa correta.
- *Mensagem de erro do PG parseada por regex*: rejeitado — frágil, depende de locale e versão do PG.
- *Extrair helpers para `lib/db/postgres-errors.ts` compartilhado entre `DrizzleNarratorRepository` e `DrizzleEditorRepository`*: diferir (YAGNI). A duplicação é mínima (~15 linhas) e só compensa extrair se/quando um terceiro consumidor aparecer.

---

## R4 — Paridade visual com Narrador via Pencil MCP

**Decisão**: Antes de implementar os componentes React (passo 7 do Fluxo TDD no `plan.md`), consultar `design.pen` via Pencil MCP (`get_editor_state` + `batch_get` buscando padrões tipo `editor`, `editores`) para verificar se há alguma divergência visual intencional entre as telas de Narrador e Editor (ex: coluna extra, ordem de campos, labels específicos). Se não houver divergência, duplicar 1:1 os componentes de Narrador e adicionar o campo `email`. Se houver divergência, documentar no commit ou em comentário inline.

**Rationale**:
- Princípio XV e VII exigem consulta ao `design.pen` para telas novas.
- A spec assume paridade visual, mas o design pode revelar nuances (ex: truncamento de e-mail longo, ícone distinto).

**Alternativas consideradas**:
- *Pular Pencil MCP e copiar Narrador direto*: rejeitado por violar §XV; barato demais para pular.

---

## R5 — TanStack Table com duas colunas ordenáveis

**Decisão**: Reusar a mesma configuração de `ColumnDef` já utilizada em `NarratorsTable`, adicionando uma segunda coluna para `email`:

```ts
const columns: ColumnDef<Editor>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => <SortableHeader column={column}>Nome</SortableHeader>,
    cell: ({ row }) => <EditorRow editor={row.original} />,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "email",
    header: ({ column }) => <SortableHeader column={column}>E-mail</SortableHeader>,
    cell: ({ row }) => <span>{row.original.email}</span>,
    sortingFn: "alphanumeric",
  },
  // actions column
];
```

Sorting client-side (mesmo padrão de Narrador). Volume ≤ dezenas — OK.

**Rationale**:
- Reuso do shadcn `DataTable` já instalado; zero nova dependência.
- Sorting client-side evita round-trips para API em volumes pequenos.

**Alternativas consideradas**:
- *Servidor-side sorting via query params*: rejeitado por over-engineering dado o volume.

---

## R6 — Idempotência de PATCH com `email` em mesma capitalização normalizada

**Decisão**: Quando o usuário edita um editor mantendo o e-mail com capitalização diferente mas semanticamente igual (ex: de `Carla@Studio.com` para `carla@studio.com`), o service normaliza ambos para `carla@studio.com` e delega ao repo. O `UPDATE` do PostgreSQL contra o próprio registro não viola o `uniqueIndex` (a linha da própria row não é considerada duplicata de si mesma). Comportamento é idempotente e correto — já coberto pelo Acceptance Scenario 8 de US3.

**Rationale**:
- Postgres handles `UPDATE ... SET email = <same value>` ou `UPDATE` que mantém o valor: o índice é consultado após a mudança proposta e aceita se apenas a própria linha tem o valor.
- Nenhuma lógica extra no service/repo é necessária.

---

## R7 — Ordem das tasks para TDD com suíte nova

**Decisão**: Escrever testes primeiro em cada camada e implementar o mínimo para eles ficarem verdes, na ordem: **DB schema → domain types → integration tests do repo → repo impl → unit tests do service (com fake in-memory) → service impl → factory → unit tests da API → API handlers → UI tests E2E → componentes UI → seed**. A ordem é similar à usada na feature 015 (CRUD original de Narradores), ajustada para não tocar `seed-test.ts`.

**Rationale**:
- Começar pelo schema DB "força" o compilador TypeScript a apontar todos os call-sites que precisam do tipo `Editor`.
- Integration tests antes de unit tests da API: a constraint única precisa estar verificada contra DB real antes de escrever stubs em memória que assumem esse comportamento.

**Alternativas consideradas**:
- *UI-first (top-down)*: rejeitado — aumenta o risco de reescrever camadas inferiores depois.

---

## R8 — Factory de teste: `createTestEditor`

**Decisão**: Adicionar em `__tests__/helpers/factories.ts` uma função `createTestEditor(db, overrides?)` espelhando `createTestNarrator`, com defaults randomizados:

```ts
interface CreateTestEditorOptions {
  readonly name?: string;
  readonly email?: string;
}

export async function createTestEditor(
  db: TestDb,
  overrides: CreateTestEditorOptions = {},
): Promise<{ editor: typeof editor.$inferSelect }> {
  const suffix = randomUUID().slice(0, 8);
  const [createdEditor] = await db
    .insert(editor)
    .values({
      name: overrides.name ?? `Editor ${suffix}`,
      email: overrides.email ?? `editor-${suffix}@test.local`,
    })
    .returning();
  return { editor: createdEditor };
}
```

**Rationale**:
- Segue explicitamente a regra "factory, não seed" (Princípio V): `seed-test.ts` NÃO é modificado.
- Sufixo `randomUUID().slice(0, 8)` garante unicidade entre factories concorrentes.
- Permite overrides opcionais para testes específicos (ex: testar duplicidade passando o mesmo `email`).

---

## Resumo de riscos

| Risco | Mitigação |
|-------|-----------|
| Cliente envia `email` em maiúsculas e o servidor persiste em maiúsculas | Normalização no service garante sempre minúsculas (R2). Teste unitário do service cobre. |
| Cliente envia campos extras além de `name` e `email` | Zod default descarta chaves extras; testes cobrem. |
| Race condition em dois POSTs com mesmo email | Constraint única + catch específico do constraint name (R3). |
| Constraint name do Drizzle difere do esperado em versões futuras | Integration test verifica explicitamente que o constraint `editor_email_unique` e `editor_name_unique` existem e respondem como esperado; quebra cedo. |
| Duplicação de helpers entre repos Narrador/Editor (`POSTGRES_UNIQUE_VIOLATION`, `isUniqueViolation`) | Aceito por YAGNI até surgir terceiro consumidor; refactor trivial no futuro. |
| Layout da tabela quebra em mobile com 2 colunas + ações | Testes E2E responsive cobrem; se necessário, ajustar `min-width`/`truncate` na coluna email (ponto de ajuste previsto, não bloqueador). |
| `design.pen` não tem seção Editores formal | Fallback: usar a seção Narradores como referência e duplicar. Documentar no PR. |

---

## Conclusão

Todas as decisões pequenas foram resolvidas. Nenhuma dúvida bloqueadora. Feature pronta para `/speckit.tasks`.
