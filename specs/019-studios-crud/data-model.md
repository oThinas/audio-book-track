# Data Model: CRUD de Estúdios

**Feature**: 019-studios-crud
**Date**: 2026-04-21

---

## Entity: Studio

Parceiro que contrata a produção e edição de audiobooks. Carrega um valor-hora **padrão** usado apenas para pré-preencher `livro.preço_por_hora` no momento da criação de livros vinculados (ver spec FR-026 e research §R2).

### Attributes

| Attribute | Type (TS) | Type (PostgreSQL) | Nullability | Notes |
|---|---|---|---|---|
| `id` | `string` (UUID v4) | `text PRIMARY KEY` | NOT NULL | Gerado por `crypto.randomUUID()` via `$defaultFn`. |
| `name` | `string` | `text` | NOT NULL | 2–100 caracteres (Zod, aplicado no service após `trim()`). Único (index `studio_name_unique`). Case-sensitive. |
| `defaultHourlyRate` | `number` (reais) | `numeric(10,2)` | NOT NULL | Faixa `0.01 ≤ x ≤ 9999.99`, máximo 2 casas decimais. Armazenado como string Drizzle; convertido a `number` na borda do repository (ver research §R2). |
| `createdAt` | `Date` | `timestamptz` | NOT NULL | `DEFAULT now()`. |
| `updatedAt` | `Date` | `timestamptz` | NOT NULL | `DEFAULT now()`, atualizado via `$onUpdate(() => new Date())`. |

### TypeScript interface (`src/lib/domain/studio.ts`)

```typescript
export interface Studio {
  readonly id: string;
  readonly name: string;
  readonly defaultHourlyRate: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

### Zod schemas

```typescript
export const studioFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  defaultHourlyRate: z
    .number({ error: "Valor/hora é obrigatório" })
    .min(0.01, "Valor/hora mínimo é R$ 0,01")
    .max(9999.99, "Valor/hora máximo é R$ 9.999,99")
    .refine(
      (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
      "Valor/hora deve ter no máximo 2 casas decimais",
    ),
});

export const createStudioSchema = studioFormSchema;
export const updateStudioSchema = studioFormSchema.partial();

export type StudioFormValues = z.infer<typeof studioFormSchema>;
export type CreateStudioInput = z.infer<typeof createStudioSchema>;
export type UpdateStudioInput = z.infer<typeof updateStudioSchema>;
```

### Drizzle schema (`src/lib/db/schema.ts`, appended)

```typescript
export const studio = pgTable(
  "studio",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    defaultHourlyRate: numeric("default_hourly_rate", { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("studio_name_unique").on(table.name)],
);
```

### Generated migration SQL (esperada)

```sql
CREATE TABLE "studio" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "default_hourly_rate" numeric(10, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "studio_name_unique" ON "studio" USING btree ("name");
```

Nenhum `CHECK CONSTRAINT` de faixa no banco — validação de `0.01 ≤ x ≤ 9999.99` é responsabilidade do service (Princípio VI: regras de negócio em domain/service, não em infraestrutura).

---

## Relationships

Nenhuma nesta feature. **Relações futuras (fora de escopo)**:

- `book.studio_id` (FK) — `studio` 1 → N `book`. Será adicionada quando o CRUD de Livros for implementado.
- Restrição de exclusão: "não excluir estúdio com livros vinculados em status ativo" também será adicionada na feature de livros.

---

## Invariants

1. **Unicidade de nome**: garantida por `uniqueIndex("studio_name_unique")`. Violação mapeada a `StudioNameAlreadyInUseError`.
2. **Faixa de valor**: `0.01 ≤ defaultHourlyRate ≤ 9999.99` — aplicada no Zod schema (cliente e API), sem CHECK no banco.
3. **Decimais**: exatamente 2 casas decimais na persistência, garantido por `.toFixed(2)` na borda do repository.
4. **`name` trimado**: aplicado no service antes de chamar o repository.
5. **Determinismo**: nenhuma operação do `StudioService` tem side effect além do banco; nenhuma chamada a `Date.now()` fora dos `defaultNow()` do schema.

---

## State transitions

Estúdio não tem ciclo de vida próprio. Estados possíveis: `exists` / `deleted`.

| From | To | Trigger |
|---|---|---|
| (não existe) | `exists` | `POST /api/v1/studios` |
| `exists` | `exists` | `PATCH /api/v1/studios/:id` (atualização de `name` e/ou `defaultHourlyRate`) |
| `exists` | (não existe) | `DELETE /api/v1/studios/:id` |

---

## Repository interface (`src/lib/domain/studio-repository.ts`)

```typescript
export interface StudioRepository {
  findAll(): Promise<Studio[]>;
  findById(id: string): Promise<Studio | null>;
  findByName(name: string): Promise<Studio | null>;
  create(input: CreateStudioInput): Promise<Studio>;
  update(id: string, input: UpdateStudioInput): Promise<Studio>;
  delete(id: string): Promise<void>;
}
```

**Nota**: não há `findByEmail` (não aplicável) nem `findByDefaultHourlyRate` (não há unicidade por valor).

---

## Service contract (`src/lib/services/studio-service.ts`)

```typescript
export class StudioService {
  constructor(private readonly repository: StudioRepository) {}

  async list(): Promise<Studio[]> {
    return this.repository.findAll();
  }

  async create(input: CreateStudioInput): Promise<Studio> {
    return this.repository.create({
      name: input.name.trim(),
      defaultHourlyRate: input.defaultHourlyRate,
    });
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    return this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.defaultHourlyRate !== undefined
        ? { defaultHourlyRate: input.defaultHourlyRate }
        : {}),
    });
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
```

Service não normaliza `defaultHourlyRate` (ao contrário de `name` com `trim`) porque o `MoneyInput` já publica um number canônico.

---

## Domain errors (`src/lib/errors/studio-errors.ts`)

```typescript
export class StudioNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "StudioNameAlreadyInUseError";
  }
}

export class StudioNotFoundError extends Error {
  constructor(id: string) {
    super(`Estúdio não encontrado: ${id}`);
    this.name = "StudioNotFoundError";
  }
}
```

Não há `StudioValueAlreadyInUseError` — valor/hora não é único entre estúdios (dois estúdios podem cobrar a mesma taxa padrão).

---

## Data size / scale assumptions

- Volume esperado: **dezenas** de estúdios (parceiros comerciais do produtor).
- Nenhuma paginação implementada nesta feature — `GET /api/v1/studios` retorna lista completa.
- `SELECT` sempre com colunas explícitas (`STUDIO_COLUMNS`) — zero `SELECT *` em produção (Princípio XI).
