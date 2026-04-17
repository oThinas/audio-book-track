# Quickstart: Test Database Isolation

**Feature**: 016-test-db-isolation
**Date**: 2026-04-17

Como configurar e usar a nova infra de testes isolados, local e no CI.

---

## 1. Setup local (primeira vez)

### 1.1. Criar `.env.test`

Copie `.env.example` e preencha:

```bash
cp .env.example .env.test
```

Edite `.env.test`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audiobook_track
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/audiobook_track_test
BETTER_AUTH_SECRET=<qualquer valor local>
BETTER_AUTH_URL=http://localhost:1197
NODE_ENV=test
```

`.env.test` está no `.gitignore`. Nunca commite.

### 1.2. Criar a base de teste

```bash
bun run db:test:setup
```

O comando é idempotente. Ele:
1. Cria `audiobook_track_test` se não existir.
2. Aplica migrations em `public`.
3. Executa seed-test (cria admin).

### 1.3. Rodar os testes

```bash
bun run test:unit          # sem DB, sempre foi isolado
bun run test:integration   # agora bate em audiobook_track_test
bun run test:e2e           # cria schemas e2e_w* automaticamente
```

---

## 2. Fluxo do dia a dia

### Ao rodar `bun run dev`

Usa apenas `DATABASE_URL` (base de dev). Dados manuais ficam intactos mesmo se você rodar testes em paralelo em outro terminal.

### Ao rodar `bun run test:e2e`

1. `globalSetup` remove schemas `e2e_*` órfãos com mais de 1 hora.
2. Playwright inicia N workers (default em local, 4 no CI).
3. Cada worker:
   - Cria schema único (`e2e_w0_abc123de`).
   - Aplica migrations.
   - Sobe Next.js em porta própria (`3100 + workerIndex`).
   - Executa todos os seus testes, dando `TRUNCATE` seletivo entre eles.
   - No fim, drop do schema.

### Ao adicionar uma nova entidade de domínio (ex: `book`)

1. `bunx drizzle-kit generate` gera a migration.
2. `bun run db:migrate` aplica em dev.
3. No próximo `bun run test:e2e`, os schemas de worker são recriados do zero e pegam a nova migration automaticamente. **Não toque `seed-test.ts`.**
4. Adicione uma factory em [__tests__/helpers/factories.ts](__tests__/helpers/factories.ts):

   ```ts
   export async function createTestBook(
     db: TestDb,
     overrides: { studioId: string; pricePerHour?: string; title?: string },
   ): Promise<{ book: typeof book.$inferSelect }> { /* ... */ }
   ```

5. Nos testes que precisam de livro, use a factory:

   ```ts
   test("algo com livro", async ({ page, appServer }) => {
     const db = getTestDbFor(appServer.schemaName);
     const { book } = await createTestBook(db, { studioId: someStudio.id });
     // ...
   });
   ```

---

## 3. Escrevendo um teste E2E

```ts
import { test, expect } from "../e2e/fixtures/app-server";
import { login } from "../e2e/helpers/auth";

test.describe("Narrators CRUD", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("cria um narrador", async ({ page }) => {
    await page.goto("/narrators");
    await page.getByRole("button", { name: "Novo narrador" }).click();
    // ...
    await expect(page.getByText("Narrador criado")).toBeVisible();
  });
});
```

Pontos importantes:

- Importe `test` de `__tests__/e2e/fixtures/app-server`, **não** de `@playwright/test`. Isso ativa o fixture do servidor por worker.
- `page.goto("/")` já resolve pra porta correta automaticamente (a fixture injeta o `baseURL`).
- Não precisa de `beforeAll` para criar dados — use factories em `beforeEach` ou dentro do teste.

---

## 4. Escrevendo um teste integration

Não muda nada. O que já funciona continua:

```ts
import { getTestDb } from "@tests/helpers/db";
import { createTestUser } from "@tests/helpers/factories";

test("cria usuário", async () => {
  const db = getTestDb();
  const { user } = await createTestUser(db);
  expect(user.id).toBeTruthy();
});
```

O que mudou por baixo: `getTestDb()` agora conecta em `audiobook_track_test` em vez de `audiobook_track`.

---

## 5. Troubleshooting

### "TEST_DATABASE_URL is required when NODE_ENV=test"

Você rodou `test:integration` ou `test:e2e` sem `.env.test` configurado. Volte ao passo 1.1.

### "schema e2e_w0_abc123de already exists"

Um processo anterior morreu sem cleanup. Rode:

```bash
bun run scripts/db/clean-orphan-schemas.ts
```

Ou apenas rode `bun run test:e2e` de novo — o `globalSetup` limpa schemas com mais de 1h automaticamente.

### "ECONNREFUSED localhost:5432"

Postgres não está rodando. Suba seu stack local (Docker Compose, homebrew services, etc).

### "listen EADDRINUSE: address already in use :::3100"

Um Next.js de uma execução anterior continua no ar. Mate com `lsof -ti:3100-3103 | xargs kill -9` e rode de novo.

### Teste falha no CI mas passa local

Aumente o trace: `retries: 2` já está habilitado no CI. Baixe o relatório HTML do artifact do workflow e inspecione.

---

## 6. CI

O workflow `.github/workflows/ci.yml` passa a:

1. Subir um serviço `postgres:16` em serviço Docker no job.
2. Criar `audiobook_track_test` (via `db:test:setup`).
3. Rodar `test:unit` + `test:integration` + `test:e2e --workers=4`.
4. Publicar report HTML como artifact em falha.

Não há segredo extra — o `TEST_DATABASE_URL` é montado no próprio workflow.

---

## 7. Validação de sucesso

Depois do merge, estas verificações devem passar (uma vez cada, manualmente, antes do próximo PR tocar a área):

- [ ] `bun run test:e2e` local com 4 workers forçados — todos os testes passam em 10 execuções consecutivas.
- [ ] Criar registros manuais em dev → rodar suíte completa → confirmar que registros continuam intactos.
- [ ] Rodar `bun run test:e2e`, matar com Ctrl+C no meio, rodar de novo — segunda execução passa.
- [ ] Abrir PR com mudança em seed-test → revisor rejeita (não deve ser necessário mexer nele para features de domínio).

### 7.3. US5 — baseline local: serial vs paralelo (Phase 7)

Para documentar o ganho de paralelismo local, rodar a suíte E2E duas vezes na mesma máquina:

```bash
# serial (como no CI)
NODE_ENV=test bunx playwright test --workers=1 | tee /tmp/e2e-serial.log

# default (Playwright decide; em máquina 4+ cores, ~4 workers)
bun run test:e2e | tee /tmp/e2e-parallel.log
```

Anotar no PR: o tempo total paralelo deve ser ≥ 40% menor que o serial (SC-005). Se não for, verificar:

1. O host tem pelo menos 4 CPUs disponíveis.
2. Nenhum worker falhou por `EADDRINUSE` — se houver colisão de portas, aumentar `BASE_E2E_PORT` em `fixtures/app-server.ts`.
3. Postgres não está com limite de conexões abaixo do necessário (4 workers × ~5 conexões = 20, bem abaixo do default 100).

### 7.2. US3 — admin session sobrevive aos resets (Phase 5)

Roteiro para provar que `truncateDomainTables` não invalida a sessão do admin:

1. Rodar a suíte E2E inteira:

   ```bash
   bun run test:e2e
   ```

2. Observar: nenhum teste deve redirecionar para `/login` depois do primeiro login no `beforeEach`. Se os dados do admin fossem apagados, qualquer teste que rodasse depois precisaria logar de novo.

3. Abrir `playwright-report/`, filtrar por testes que exercitam rotas autenticadas (ex.: `settings`, `mobile-sidebar`), e confirmar que o primeiro `page.goto(...)` após login mantém cookie válido.

4. Opcional: grep os testes por `beforeEach.*login` — cada arquivo loga apenas uma vez no próprio `beforeEach` (não entre testes dentro do mesmo describe).

### 7.1. US1 — verificação manual (Phase 3)

Roteiro para provar que `bun run test:integration` NÃO toca `audiobook_track`:

1. Inserir um marcador em dev:

   ```bash
   psql "$DATABASE_URL" -c "INSERT INTO \"user\" (id, name, email, \"emailVerified\", \"createdAt\", \"updatedAt\") VALUES ('DEV_RECORD', 'dev-marker', 'dev-marker@local', false, now(), now());"
   ```

2. Rodar a suíte:

   ```bash
   bun run test:integration
   ```

3. Confirmar que o registro sobreviveu:

   ```bash
   psql "$DATABASE_URL" -c "SELECT id FROM \"user\" WHERE id = 'DEV_RECORD';"
   ```

   Deve retornar exatamente 1 linha. Se zero, a integração não está usando `TEST_DATABASE_URL` e Phase 3 está quebrada.

4. Limpeza (opcional):

   ```bash
   psql "$DATABASE_URL" -c "DELETE FROM \"user\" WHERE id = 'DEV_RECORD';"
   ```
