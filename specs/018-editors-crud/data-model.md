# Data Model: Editor

**Feature**: 018-editors-crud
**Date**: 2026-04-17

## Entidade `Editor` (nova)

### Estado alvo

```ts
interface Editor {
  readonly id: string;          // UUID v4 gerado pelo banco
  readonly name: string;        // 2–100 chars, obrigatório, único (case-sensitive após trim)
  readonly email: string;       // ≤255 chars, obrigatório, único (case-insensitive após trim+lowercase)
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
```

Tabela `editor` em `src/lib/db/schema.ts`:

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

### Validações (Zod) — `src/lib/domain/editor.ts`

```ts
export const editorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nome deve ter no mínimo 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório")
    .max(255, "E-mail deve ter no máximo 255 caracteres")
    .email("E-mail inválido"),
});

export const createEditorSchema = editorFormSchema;
export const updateEditorSchema = editorFormSchema.partial();

export type EditorFormValues = z.infer<typeof editorFormSchema>;
export type CreateEditorInput = z.infer<typeof createEditorSchema>;
export type UpdateEditorInput = z.infer<typeof updateEditorSchema>;
```

> **Importante**: o schema Zod **não** aplica `.toLowerCase()` no email. A normalização é aplicada no `EditorService` antes de chamar o repository (research.md §R2).

### Regras de unicidade

| Campo  | Normalização antes da comparação | Implementação |
|--------|----------------------------------|---------------|
| `name` | `trim()` apenas (case-sensitive, sem NFC, sem collapse de espaços internos) | Zod `.trim()` + `uniqueIndex("editor_name_unique")` byte-exato |
| `email` | `trim()` + `toLowerCase()` | Service `input.email.trim().toLowerCase()` antes de persistir + `uniqueIndex("editor_email_unique")` byte-exato (funciona porque o valor já chega normalizado) |

Dois editores com:
- `name = "Carla"` e `name = "carla"` → **permitidos** (case-sensitive).
- `email = "Carla@Studio.com"` e `email = "carla@studio.com"` → **rejeitados** (segundo conflita — ambos normalizam para `carla@studio.com`).

### Regras de estado / ciclo de vida

- Editor não tem ciclo de vida (sem campo `status`). Sem mudança.

### Relacionamentos

- Sem FKs entrantes ou saintes nesta feature.
- **Futuro**: `chapter.editor_id` referenciará `editor.id` quando a entidade capítulo for criada. Essa FK virá com índice (Princípio XI) e com constraint de "não excluir editor com capítulos em andamento", análogo ao padrão de Narrador.

### Migração SQL (ordem esperada do drizzle-kit)

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

- Arquivo gerado: `drizzle/000X_<auto-nome>.sql`.
- Journal: `drizzle/meta/_journal.json` atualizado automaticamente.
- **Pré-condição**: nenhuma (tabela nova, vazia no momento da criação).
- **Reversível?** Sim: `DROP TABLE "editor";` (nenhum FK apontando para ela nesta feature). Rollback trivial.

## Interface `EditorRepository` — `src/lib/domain/editor-repository.ts`

```ts
import type { CreateEditorInput, Editor, UpdateEditorInput } from "./editor";

export interface EditorRepository {
  findAll(): Promise<Editor[]>;
  findById(id: string): Promise<Editor | null>;
  findByName(name: string): Promise<Editor | null>;
  findByEmail(email: string): Promise<Editor | null>;
  create(input: CreateEditorInput): Promise<Editor>;
  update(id: string, input: UpdateEditorInput): Promise<Editor>;
  delete(id: string): Promise<void>;
}
```

> `findByName(name)` e `findByEmail(email)` recebem o valor **já normalizado pelo chamador** (`trim()` sempre; `toLowerCase()` apenas para email). Servem para validação antecipada e mensagens amigáveis; a garantia primária de unicidade é o índice único do PostgreSQL, via catch de violation no `create`/`update`.

## Erros de domínio — `src/lib/errors/editor-errors.ts`

```ts
export class EditorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "EditorNameAlreadyInUseError";
  }
}

export class EditorEmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "EditorEmailAlreadyInUseError";
  }
}

export class EditorNotFoundError extends Error {
  constructor(id: string) {
    super(`Editor não encontrado: ${id}`);
    this.name = "EditorNotFoundError";
  }
}
```

## Implementação `DrizzleEditorRepository` — estrutura

```ts
const EDITOR_COLUMNS = {
  id: editor.id,
  name: editor.name,
  email: editor.email,
  createdAt: editor.createdAt,
  updatedAt: editor.updatedAt,
} as const;

const POSTGRES_UNIQUE_VIOLATION = "23505";
const EDITOR_NAME_CONSTRAINT = "editor_name_unique";
const EDITOR_EMAIL_CONSTRAINT = "editor_email_unique";

function getUniqueConstraintName(error: unknown): string | null { /* ver research.md §R3 */ }

export class DrizzleEditorRepository implements EditorRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findAll(): Promise<Editor[]> { /* select().orderBy(asc(editor.createdAt)) */ }
  async findById(id: string): Promise<Editor | null> { /* where eq */ }
  async findByName(name: string): Promise<Editor | null> { /* where eq */ }
  async findByEmail(email: string): Promise<Editor | null> { /* where eq */ }

  async create(input: CreateEditorInput): Promise<Editor> {
    try {
      const [row] = await this.db.insert(editor).values({ name: input.name, email: input.email }).returning(EDITOR_COLUMNS);
      return row;
    } catch (error) {
      const constraint = getUniqueConstraintName(error);
      if (constraint === EDITOR_NAME_CONSTRAINT) throw new EditorNameAlreadyInUseError(input.name);
      if (constraint === EDITOR_EMAIL_CONSTRAINT) throw new EditorEmailAlreadyInUseError(input.email);
      throw error;
    }
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    try {
      const [row] = await this.db
        .update(editor)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
        })
        .where(eq(editor.id, id))
        .returning(EDITOR_COLUMNS);
      if (!row) throw new EditorNotFoundError(id);
      return row;
    } catch (error) {
      if (error instanceof EditorNotFoundError) throw error;
      const constraint = getUniqueConstraintName(error);
      if (constraint === EDITOR_NAME_CONSTRAINT && input.name !== undefined) throw new EditorNameAlreadyInUseError(input.name);
      if (constraint === EDITOR_EMAIL_CONSTRAINT && input.email !== undefined) throw new EditorEmailAlreadyInUseError(input.email);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.db.delete(editor).where(eq(editor.id, id)).returning({ id: editor.id });
    if (deleted.length === 0) throw new EditorNotFoundError(id);
  }
}
```

## Implementação `EditorService` — estrutura

```ts
export class EditorService {
  constructor(private readonly repository: EditorRepository) {}

  async list(): Promise<Editor[]> { return this.repository.findAll(); }

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

  async delete(id: string): Promise<void> { return this.repository.delete(id); }
}
```

## Implementação `InMemoryEditorRepository` (para unit tests) — estrutura

```ts
export class InMemoryEditorRepository implements EditorRepository {
  private readonly store = new Map<string, Editor>();

  async findAll(): Promise<Editor[]> {
    return Array.from(this.store.values()).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
  }
  async findById(id: string): Promise<Editor | null> { return this.store.get(id) ?? null; }
  async findByName(name: string): Promise<Editor | null> { /* linear scan comparando name === name (input já normalizado) */ }
  async findByEmail(email: string): Promise<Editor | null> { /* linear scan comparando email === email (input já normalizado) */ }

  async create(input: CreateEditorInput): Promise<Editor> {
    // input já vem trimmed/lowercased pelo service; ainda assim, protegemos com trim/lower defensivo
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();

    if (await this.findByName(name)) throw new EditorNameAlreadyInUseError(name);
    if (await this.findByEmail(email)) throw new EditorEmailAlreadyInUseError(email);

    const now = new Date();
    const newEditor: Editor = {
      id: crypto.randomUUID(),
      name,
      email,
      createdAt: now,
      updatedAt: now,
    };
    this.store.set(newEditor.id, newEditor);
    return newEditor;
  }

  async update(id: string, input: UpdateEditorInput): Promise<Editor> {
    const existing = this.store.get(id);
    if (!existing) throw new EditorNotFoundError(id);

    if (input.name !== undefined) {
      const trimmedName = input.name.trim();
      if (trimmedName !== existing.name) {
        const duplicate = await this.findByName(trimmedName);
        if (duplicate && duplicate.id !== id) throw new EditorNameAlreadyInUseError(trimmedName);
      }
    }

    if (input.email !== undefined) {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const duplicate = await this.findByEmail(normalizedEmail);
        if (duplicate && duplicate.id !== id) throw new EditorEmailAlreadyInUseError(normalizedEmail);
      }
    }

    const updated: Editor = {
      ...existing,
      name: input.name !== undefined ? input.name.trim() : existing.name,
      email: input.email !== undefined ? input.email.trim().toLowerCase() : existing.email,
      updatedAt: new Date(),
    };
    this.store.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    if (!this.store.has(id)) throw new EditorNotFoundError(id);
    this.store.delete(id);
  }

  clear(): void { this.store.clear(); }
}
```

## Exemplos de payloads API (para referência de testes)

### `POST /api/v1/editors`

```json
{ "name": "Carla Mendes", "email": "carla@studio.com" }
```

Resposta `201`:

```json
{
  "data": {
    "id": "uuid",
    "name": "Carla Mendes",
    "email": "carla@studio.com",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### `PATCH /api/v1/editors/:id`

```json
{ "name": "Carla M." }
```
ou
```json
{ "email": "nova@studio.com" }
```
ou ambos. Payload vazio `{}` é válido (no-op).

### `GET /api/v1/editors`

```json
{
  "data": [
    { "id": "uuid", "name": "Carla Mendes", "email": "carla@studio.com", "createdAt": "...", "updatedAt": "..." }
  ]
}
```
