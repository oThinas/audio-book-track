# Data Model: Narrador (após remoção do e-mail)

**Feature**: 017-narrator-remove-email
**Date**: 2026-04-17

## Entidade `Narrator` (alterada)

### Estado atual (antes da feature)

```ts
interface Narrator {
  readonly id: string;          // UUID v4
  readonly name: string;        // 2–100 chars
  readonly email: string;       // formato email, único, lowercase
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

Tabela `narrator` em `src/lib/db/schema.ts`:

```ts
export const narrator = pgTable(
  "narrator",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    email: text("email").notNull(),           // ← REMOVIDO
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("narrator_email_unique").on(table.email)], // ← REMOVIDO
);
```

### Estado alvo (após a feature)

```ts
interface Narrator {
  readonly id: string;          // UUID v4
  readonly name: string;        // 2–100 chars, obrigatório
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

```ts
export const narrator = pgTable(
  "narrator",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("narrator_name_unique").on(table.name)],
);
```

> A unicidade que antes era garantida pelo `email` passa a ser garantida pelo `name`. PostgreSQL trata o `uniqueIndex` em coluna `text` como **case-sensitive e byte-exact**, o que coincide com a regra de produto (FR-017).

### Validações (Zod)

```ts
export const narratorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
});

export const createNarratorSchema = narratorFormSchema;
export const updateNarratorSchema = narratorFormSchema.partial();

export type NarratorFormValues = z.infer<typeof narratorFormSchema>;
export type CreateNarratorInput = z.infer<typeof createNarratorSchema>;
export type UpdateNarratorInput = z.infer<typeof updateNarratorSchema>;
```

### Regras de unicidade

- **Antes**: `email` era único (índice `narrator_email_unique`). Comparação após `trim().toLowerCase()` no nível do Zod.
- **Depois**: `name` é único (índice `narrator_name_unique`). Comparação após `trim()` apenas — **case-sensitive**, sem normalização de acentos ou espaços internos. Dois narradores com o mesmo nome exato são rejeitados com `409 NAME_ALREADY_IN_USE`.

### Regras de estado / ciclo de vida

- Narrador não tem ciclo de vida (não há campo `status`). Sem mudança.

### Relacionamentos

- Sem FKs entrantes ou saintes hoje. A relação futura com capítulo (quando a feature de capítulos existir) referenciará `narrator.id` — nada afetado pela remoção do e-mail.

### Migração SQL (ordem esperada do drizzle-kit)

```sql
DROP INDEX "narrator_email_unique";
ALTER TABLE "narrator" DROP COLUMN "email";
CREATE UNIQUE INDEX "narrator_name_unique" ON "narrator" ("name");
```

- Arquivo gerado: `drizzle/0003_<auto-nome>.sql`. Ordem das instruções pode variar; todas são necessárias.
- Journal: `drizzle/meta/_journal.json` atualizado automaticamente.
- **Pré-condição de dev**: a base não pode ter duas linhas com o mesmo `name` no momento em que o `CREATE UNIQUE INDEX` roda. Se tiver, a migração falha e o usuário deduplica (`DELETE FROM narrator WHERE ...`) antes de retentar.
- Reversível? Não na prática — os valores originais de `email` são descartados. Para reverter, é preciso recriar a coluna, o índice antigo, e re-popular (dados perdidos). Aceito por produto.

## Interface `NarratorRepository`

### Antes

```ts
interface NarratorRepository {
  findAll(): Promise<Narrator[]>;
  findById(id: string): Promise<Narrator | null>;
  findByEmail(email: string): Promise<Narrator | null>;    // ← SUBSTITUÍDO por findByName
  create(input: CreateNarratorInput): Promise<Narrator>;
  update(id: string, input: UpdateNarratorInput): Promise<Narrator>;
  delete(id: string): Promise<void>;
}
```

### Depois

```ts
interface NarratorRepository {
  findAll(): Promise<Narrator[]>;
  findById(id: string): Promise<Narrator | null>;
  findByName(name: string): Promise<Narrator | null>;
  create(input: CreateNarratorInput): Promise<Narrator>;
  update(id: string, input: UpdateNarratorInput): Promise<Narrator>;
  delete(id: string): Promise<void>;
}
```

`findByName` recebe o nome **já normalizado pelo chamador** (após `trim()`, case-sensitive). Serve a validação antecipada e mensagens de erro consistentes, mas **não é a garantia primária** de unicidade — a garantia final vem da constraint `narrator_name_unique` no banco, via catch de `unique violation`.

## Erros de domínio

### Antes (`src/lib/errors/narrator-errors.ts`)

- `NarratorEmailAlreadyInUseError` — **substituído** por `NarratorNameAlreadyInUseError`.
- `NarratorNotFoundError` — mantido.

### Depois

```ts
export class NarratorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "NarratorNameAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Narrador não encontrado: ${id}`);
    this.name = "NarratorNotFoundError";
  }
}
```

## Implementação `DrizzleNarratorRepository` — mudanças

- Substituir `findByEmail` por `findByName` (select com `where(eq(narrator.name, name))`).
- **Manter** a constante `POSTGRES_UNIQUE_VIOLATION` e os helpers `hasUniqueViolationCode`/`isUniqueViolation` — a constraint agora é em `name`, não mais em `email`.
- Remover `email` de `NARRATOR_COLUMNS`.
- `create` continua com `try/catch`: no `unique_violation`, lançar `NarratorNameAlreadyInUseError(input.name)` em vez de `NarratorEmailAlreadyInUseError(input.email)`.
- `update` idem: no `unique_violation` com `input.name !== undefined`, lançar `NarratorNameAlreadyInUseError(input.name)`.
- `update` continua validando existência via `.returning()` vazio → `NarratorNotFoundError`.

## Implementação `InMemoryNarratorRepository` — mudanças

- Substituir `findByEmail` por `findByName`.
- Remover normalização `email.trim().toLowerCase()` em `create` e `update`.
- `create`: aplicar `input.name.trim()` e verificar duplicata via `findByName(trimmedName)`; se existir, lançar `NarratorNameAlreadyInUseError(trimmedName)`.
- `update`: se `input.name !== undefined`, aplicar `trim()` e verificar duplicata que não seja o próprio registro; lançar `NarratorNameAlreadyInUseError` quando conflitante.

## Exemplo de payloads API (para referência de testes)

### `POST /api/v1/narrators`

```json
// Antes
{ "name": "Ana Paula", "email": "ana@example.com" }

// Depois
{ "name": "Ana Paula" }
```

### `PATCH /api/v1/narrators/:id`

```json
// Antes
{ "name": "Ana P.", "email": "ana.p@example.com" }

// Depois
{ "name": "Ana P." }
```

### Resposta de `GET /api/v1/narrators`

```json
// Antes
{ "data": [{ "id": "...", "name": "Ana Paula", "email": "ana@example.com", "createdAt": "...", "updatedAt": "..." }] }

// Depois
{ "data": [{ "id": "...", "name": "Ana Paula", "createdAt": "...", "updatedAt": "..." }] }
```
