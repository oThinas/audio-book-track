# Quickstart: Remoção do campo e-mail de Narradores

**Feature**: 017-narrator-remove-email
**Date**: 2026-04-17

Guia curto para validar manualmente a feature em ambiente local. Para o fluxo automatizado, ver `plan.md` §Fluxo TDD e o `tasks.md` (gerado por `/speckit.tasks`).

## Pré-requisitos

- Branch `017-narrator-remove-email` checked out.
- Banco de dev rodando: `audiobook_track` em `localhost:5432` (ou conforme `.env.local`).
- Dependências instaladas: `bun install`.

## Passo a passo local

### 1. Aplicar a migração

```bash
bun run db:generate          # gera drizzle/0003_*.sql com DROP INDEX + DROP COLUMN
bun run db:migrate           # aplica ao banco de dev
```

Inspecionar o arquivo SQL gerado antes de aplicar:

```bash
ls drizzle/ | tail -3
cat drizzle/$(ls drizzle/*.sql | tail -1)
```

Deve conter (ordem pode variar):
```sql
DROP INDEX "narrator_email_unique";
ALTER TABLE "narrator" DROP COLUMN "email";
CREATE UNIQUE INDEX "narrator_name_unique" ON "narrator" ("name");
```

> **Atenção**: se a base de dev tiver hoje dois narradores com o mesmo `name`, o passo 1 falha ao criar o índice único. Deduplicar antes:
> ```sql
> SELECT name, count(*) FROM narrator GROUP BY name HAVING count(*) > 1;
> DELETE FROM narrator WHERE id = '<id-do-duplicado>';
> ```

### 2. Verificar o banco

```bash
psql audiobook_track -c '\d narrator'
```

Esperado: colunas `id`, `name`, `created_at`, `updated_at`. **Nenhuma coluna `email`**. **Nenhum índice `narrator_email_unique`**. **Presente: índice `narrator_name_unique` UNIQUE em (name)**.

### 3. Rodar o app em dev

```bash
bun run dev          # http://localhost:1197
```

Login com admin (seed-test não toca narradores; usar `admin@audiobook.local` / senha do dev seed, se aplicável — ou criar conta).

### 4. Validar UI em `/narrators`

Checklist de validação manual:

- [ ] Tabela exibe **apenas** a coluna "Nome" + ações. Sem coluna "E-mail".
- [ ] Botão `+ Novo Narrador` cria linha editável com **apenas** o input de nome.
- [ ] Preencher nome "Ana Paula" → "Confirmar" → linha sai de edição com nome confirmado.
- [ ] Criar outro narrador com o mesmo nome "Ana Paula" → **bloqueado** com mensagem "Nome já cadastrado" no campo.
- [ ] Criar narrador com nome "ana paula" (minúsculo) → **permitido** — comparação é case-sensitive.
- [ ] Criar narrador com "  Ana Paula  " (espaços em torno) → persiste como "Ana Paula" e colide com o existente (erro de conflito) — confirma que o trim é aplicado.
- [ ] Clicar em "Editar" em uma linha existente → **apenas** o campo nome é editável.
- [ ] Alterar nome, confirmar → persistido.
- [ ] Editar mantendo o mesmo nome → permitido (sem falso positivo de conflito consigo mesmo).
- [ ] Editar para um nome já usado por outro narrador → bloqueado com "Nome já cadastrado".
- [ ] Cancelar edição → valores originais restaurados.
- [ ] Excluir narrador → modal → confirmar → removido da tabela.
- [ ] Testar em dark mode (toggle de tema).
- [ ] Testar nos 3 tamanhos de fonte (settings).
- [ ] Testar em viewport mobile (< 640px) — layout da tabela acomoda a remoção da coluna.

### 5. Validar API via curl

```bash
# POST — apenas name
curl -X POST http://localhost:1197/api/v1/narrators \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão válida>" \
  -d '{"name":"Test Narrator"}'
# Esperado: 201 + { data: { id, name, createdAt, updatedAt } } (sem campo email)

# POST com email extra — descartado silenciosamente
curl -X POST http://localhost:1197/api/v1/narrators \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão válida>" \
  -d '{"name":"Test 2","email":"legado@test.com"}'
# Esperado: 201; o objeto retornado NÃO contém email; GET subsequente confirma que email não foi persistido.

# POST duplicado (mesmo name) — conflito
curl -X POST http://localhost:1197/api/v1/narrators \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão válida>" \
  -d '{"name":"Test Narrator"}'
# Esperado: 409 + { error: { code: "NAME_ALREADY_IN_USE", message: "Nome já cadastrado" } }

# GET list
curl http://localhost:1197/api/v1/narrators -H "Cookie: <sessão válida>"
# Esperado: { data: [{ id, name, createdAt, updatedAt }, ...] }

# PATCH
curl -X PATCH http://localhost:1197/api/v1/narrators/<id> \
  -H "Content-Type: application/json" \
  -H "Cookie: <sessão válida>" \
  -d '{"name":"Renomeado"}'
# Esperado: 200 + { data: { id, name: "Renomeado", ... } }
```

### 6. Fase final de verificação (obrigatória antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

Todos devem passar sem erro nem warning. Se `test:e2e` for longo localmente, priorizar `__tests__/e2e/narrators-*.spec.ts` primeiro e a suíte completa depois.

## Rollback

A migração é destrutiva. Se precisar voltar ao estado pré-feature:

1. Reverter commits desta branch: `git checkout main`.
2. Restaurar manualmente:
   ```sql
   DROP INDEX narrator_name_unique;
   ALTER TABLE narrator ADD COLUMN email text;
   CREATE UNIQUE INDEX narrator_email_unique ON narrator (email);
   ```
3. Os valores originais de `email` **não são recuperáveis** — não há export automático. Isso é esperado conforme Assumptions da spec.

## Artefatos verificáveis

Após a feature, os seguintes greps devem retornar **zero** resultados:

```bash
rg '\bemail\b' src/lib/domain/narrator.ts src/lib/domain/narrator-repository.ts
rg '\bemail\b' src/lib/repositories/drizzle/drizzle-narrator-repository.ts
rg '\bemail\b' 'src/app/(authenticated)/narrators'
rg 'NarratorEmailAlreadyInUseError' src/ __tests__/
rg 'findByEmail' src/ __tests__/
rg 'narrator_email_unique' src/lib/db/schema.ts
```

E os seguintes DEVEM ter matches (confirmando que a constraint foi realocada para `name`):

```bash
rg 'narrator_name_unique' src/lib/db/schema.ts                       # 1 match
rg 'NarratorNameAlreadyInUseError' src/lib/errors/narrator-errors.ts # 1 match
rg 'findByName' src/lib/domain/narrator-repository.ts                # 1 match
rg 'NAME_ALREADY_IN_USE' src/app/api/v1/narrators/                   # ≥ 2 matches (POST + PATCH)
```

Se qualquer um retornar match, a feature está incompleta.
