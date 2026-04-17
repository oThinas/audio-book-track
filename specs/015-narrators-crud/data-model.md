# Data Model — CRUD de Narradores

## Entidade: Narrator

Pessoa responsável pela gravação dos capítulos de audiobooks. O e-mail é utilizado para compartilhamento de arquivos no Google Drive (integração fora do escopo desta feature).

### Fields

| Campo | Tipo SQL | Tipo TypeScript | Constraints | Observações |
|-------|----------|-----------------|-------------|-------------|
| `id` | `text` | `string` | PK, `$defaultFn(() => crypto.randomUUID())` | UUIDv4 |
| `name` | `text` | `string` | NOT NULL | Validado 2–100 chars via Zod |
| `email` | `text` | `string` | NOT NULL, UNIQUE | Lowercase + trim no input, validado como e-mail via Zod |
| `createdAt` | `timestamptz` | `Date` | NOT NULL, `defaultNow()` | |
| `updatedAt` | `timestamptz` | `Date` | NOT NULL, `defaultNow()`, `$onUpdate(() => new Date())` | Atualizado automaticamente em updates |

### Indexes

| Nome | Colunas | Tipo | Motivação |
|------|---------|------|-----------|
| `narrator_pkey` | `id` | PRIMARY KEY | Identidade |
| `narrator_email_unique` | `email` | UNIQUE | Garante unicidade (FR-006) e acelera lookups por e-mail |

### Drizzle Schema (addendum em `src/lib/db/schema.ts`)

```typescript
export const narrator = pgTable(
  "narrator",
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
  (table) => [uniqueIndex("narrator_email_unique").on(table.email)],
);
```

### Domain Type (em `src/lib/domain/narrator.ts`)

```typescript
export interface Narrator {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export const narratorFormSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

export const createNarratorSchema = narratorFormSchema;
export const updateNarratorSchema = narratorFormSchema.partial();

export type CreateNarratorInput = z.infer<typeof createNarratorSchema>;
export type UpdateNarratorInput = z.infer<typeof updateNarratorSchema>;
```

### Validation Rules

| Campo | Regra | Erro |
|-------|-------|------|
| `name` | Obrigatório, trim, 2–100 chars | `"Nome deve ter no mínimo 2 caracteres"` / `"Nome deve ter no máximo 100 caracteres"` |
| `email` | Obrigatório, trim, lowercase, formato de e-mail válido | `"E-mail inválido"` |
| `email` | Único no DB (enforced por UNIQUE index) | HTTP 409 `EMAIL_ALREADY_IN_USE` |

### State Transitions

A entidade Narrator **não possui máquina de estados**. É uma entidade mestre simples com CRUD direto.

### Relationships

- **Narrator** 1 → N **Chapter** (via `chapter.narrator_id`, a ser implementado no CRUD de Capítulos).
- Por enquanto (feature 015), **não há foreign key declarada**: a tabela `chapter` ainda não existe. A constraint de exclusão (FR-010) fica diferida — ver `futuras-features.md`.

### Domain Errors

```typescript
// src/lib/errors/narrator-errors.ts
export class NarratorEmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "NarratorEmailAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Narrador não encontrado: ${id}`);
    this.name = "NarratorNotFoundError";
  }
}
```

### Repository Interface (em `src/lib/domain/narrator-repository.ts`)

```typescript
export interface NarratorRepository {
  findAll(): Promise<Narrator[]>;
  findById(id: string): Promise<Narrator | null>;
  findByEmail(email: string): Promise<Narrator | null>;
  create(input: CreateNarratorInput): Promise<Narrator>;
  update(id: string, input: UpdateNarratorInput): Promise<Narrator>;
  delete(id: string): Promise<void>;
}
```

- `create` deve lançar `NarratorEmailAlreadyInUseError` em caso de `unique_violation` (pg error `23505`).
- `update` deve lançar `NarratorNotFoundError` se `id` não existir, e `NarratorEmailAlreadyInUseError` em caso de duplicata.
- `delete` deve lançar `NarratorNotFoundError` se `id` não existir.
- `findAll` retorna ordenado por `createdAt` ascendente (ordem estável; sort visual é client-side).

### Migration

- Gerar via `bunx drizzle-kit generate` após adicionar o schema.
- Arquivo esperado: `drizzle/0XXX_narrator_initial.sql` (número sequencial automático).
- Aplicar via `bun run db:migrate`.
- Rollback: migration reversível (ALTER/DROP coerentes — drizzle-kit gera ambos).
