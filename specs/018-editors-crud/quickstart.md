# Quickstart: CRUD de Editores

**Feature**: 018-editors-crud
**Date**: 2026-04-17

Guia para validar manualmente a feature em ambiente local após a implementação. Para o fluxo automatizado, ver `plan.md` §Fluxo TDD.

## Pré-requisitos

- Branch `018-editors-crud` checked out.
- Banco de dev rodando: `audiobook_track` em `localhost:5432` (ver `.env.local`).
- Dependências instaladas: `bun install`.

## Passo a passo local

### 1. Aplicar a migração

```bash
bun run db:generate          # gera drizzle/000X_*.sql com CREATE TABLE editor + 2 CREATE UNIQUE INDEX
bun run db:migrate           # aplica ao banco de dev
```

Inspecionar o arquivo gerado:

```bash
ls drizzle/ | tail -3
cat drizzle/$(ls drizzle/*.sql | tail -1)
```

Esperado (ordem pode variar):

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

### 2. Verificar o banco

```bash
psql audiobook_track -c '\d editor'
```

Esperado:

- Colunas `id`, `name`, `email`, `created_at`, `updated_at`.
- Índices: `editor_pkey` (PK), `editor_name_unique` (UNIQUE em `name`), `editor_email_unique` (UNIQUE em `email`).

### 3. Rodar o app em dev

```bash
bun run dev           # http://localhost:1197
```

Login com admin (mesmo do padrão de dev). A rota `/editors` deve estar acessível no menu lateral (já está listada como `favoritePage` válida em `user_preference`).

### 4. Validar UI em `/editors`

Checklist de validação manual:

- [ ] Tabela exibe colunas **"Nome"** e **"E-mail"** + ações. Cabeçalhos ordenáveis ao clicar.
- [ ] Botão `+ Novo Editor` cria linha editável com inputs de nome e e-mail.
- [ ] Preencher "Carla Mendes" + "carla@studio.com" → "Confirmar" → linha sai de edição com dados confirmados.
- [ ] Criar outro editor com o mesmo nome "Carla Mendes" → **bloqueado** com mensagem "Nome já cadastrado" no campo Nome.
- [ ] Criar outro editor com "carla mendes" (minúsculo) → **permitido** — name é case-sensitive.
- [ ] Criar outro editor com e-mail `CARLA@STUDIO.COM` → **bloqueado** com "E-mail já cadastrado" — email é case-insensitive.
- [ ] Criar editor com "  Carla Mendes  " (espaços) → persiste como "Carla Mendes"; colide com existente.
- [ ] Criar editor com e-mail "carla" (sem @) → mensagem de validação "E-mail inválido".
- [ ] Clicar em "Editar" em uma linha → ambos os campos ficam editáveis.
- [ ] Alterar apenas o e-mail, confirmar → persistido.
- [ ] Editar para nome já usado por outro → "Nome já cadastrado".
- [ ] Editar para e-mail já usado por outro → "E-mail já cadastrado".
- [ ] Editar mantendo mesmo nome/e-mail (inclusive apenas mudando capitalização do e-mail) → sem falso positivo de conflito.
- [ ] Cancelar edição → valores originais restaurados.
- [ ] Excluir editor → modal → confirmar → removido.
- [ ] Testar em dark mode (toggle de tema).
- [ ] Testar nos 3 tamanhos de fonte (settings: small, medium, large).
- [ ] Testar em viewport mobile (< 640px), tablet (640–1024px) e desktop (> 1024px).
- [ ] Testar com cada cor primária (blue, orange, green, red, amber) — ícone/botão destructive continua visualmente distinto.

### 5. Validar API via curl

Substituir `<sessão>` pelo cookie de sessão válido (copiar de DevTools após login).

```bash
# POST válido
curl -X POST http://localhost:1197/api/v1/editors \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"name":"Diego Rocha","email":"diego@studio.com"}'
# Esperado: 201 + data com email em minúsculas

# POST com email em maiúsculas — normalizado
curl -X POST http://localhost:1197/api/v1/editors \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"name":"Elisa","email":"Elisa@STUDIO.com"}'
# Esperado: 201; data.email === "elisa@studio.com"

# POST duplicado (mesmo name)
curl -X POST http://localhost:1197/api/v1/editors \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"name":"Diego Rocha","email":"outro@studio.com"}'
# Esperado: 409 + { error: { code: "NAME_ALREADY_IN_USE", message: "Nome já cadastrado" } }

# POST duplicado (mesmo email normalizado)
curl -X POST http://localhost:1197/api/v1/editors \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"name":"Outro","email":"DIEGO@studio.com"}'
# Esperado: 409 + { error: { code: "EMAIL_ALREADY_IN_USE", message: "E-mail já cadastrado" } }

# POST email inválido
curl -X POST http://localhost:1197/api/v1/editors \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"name":"Teste","email":"nao-eh-email"}'
# Esperado: 422 + details com path "email"

# GET list
curl http://localhost:1197/api/v1/editors -H "Cookie: <sessão>"
# Esperado: { data: [{ id, name, email, createdAt, updatedAt }, ...] }

# PATCH — apenas email
curl -X PATCH http://localhost:1197/api/v1/editors/<id> \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"email":"novo@studio.com"}'
# Esperado: 200 + data atualizado

# PATCH idempotente — mesmo email diferente capitalização
curl -X PATCH http://localhost:1197/api/v1/editors/<id> \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão>" \
  -d '{"email":"NOVO@studio.com"}'
# Esperado: 200 (no-op efetivo; email permanece "novo@studio.com")

# DELETE
curl -X DELETE http://localhost:1197/api/v1/editors/<id> \
  -H "Cookie: <sessão>"
# Esperado: 204 sem body
```

### 6. Fase final de verificação (obrigatória antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

Todos devem passar sem erro nem warning. Se `test:e2e` for longo localmente, priorizar `__tests__/e2e/editors-*.spec.ts` primeiro, e a suíte completa depois.

## Rollback

Feature é aditiva — rollback trivial:

```sql
DROP TABLE editor;
```

Nenhum FK apontando para a tabela, nenhum dado externo a preservar. Após rollback, reverter também os commits da branch: `git checkout main` (já que o código TypeScript referencia a tabela).

## Artefatos verificáveis

Após a feature, os seguintes greps DEVEM retornar **matches** (confirmando que a feature foi implementada):

```bash
rg 'editor_name_unique' src/lib/db/schema.ts             # 1 match
rg 'editor_email_unique' src/lib/db/schema.ts            # 1 match
rg 'EditorNameAlreadyInUseError' src/lib/errors/         # 1 match
rg 'EditorEmailAlreadyInUseError' src/lib/errors/        # 1 match
rg 'EditorNotFoundError' src/lib/errors/                 # 1 match
rg 'createEditorService' src/lib/factories/              # 1 match
rg 'DrizzleEditorRepository' src/lib/repositories/       # 1 match
rg 'class EditorService' src/lib/services/               # 1 match
rg 'NAME_ALREADY_IN_USE' src/app/api/v1/editors/         # ≥ 2 (POST + PATCH)
rg 'EMAIL_ALREADY_IN_USE' src/app/api/v1/editors/        # ≥ 2 (POST + PATCH)
```

E os seguintes devem **não** retornar matches (anti-padrões ausentes):

```bash
rg 'drizzle-kit push'                                     # proibido
rg '"SELECT \*"' src/ --type ts                           # proibido
rg '\bany\b' src/lib/domain/editor*.ts src/lib/services/editor-service.ts # evitar any
rg '<button|<input|<select' src/app/\(authenticated\)/editors/ # elementos HTML crus proibidos
```

Se qualquer verificação de "DEVE ter match" falhar, a feature está incompleta.
