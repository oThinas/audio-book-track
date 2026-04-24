# Quickstart: CRUD de Livros e Capítulos

**Feature**: 020-books-chapters-crud
**Date**: 2026-04-23
**Stage**: Phase 1

Este documento resume **como rodar e validar a feature** no ambiente local, e como executar a suíte de testes da feature isoladamente durante a implementação.

---

## Pré-requisitos

- Bun 1.2+
- PostgreSQL local (via Docker Compose do projeto ou instalação nativa).
- Variáveis em `.env.local`: `DATABASE_URL`, `TEST_DATABASE_URL`, `BETTER_AUTH_SECRET`.
- Branch `020-books-chapters-crud` já criado (feito por `/speckit-specify`).

---

## 1. Gerar migrations e aplicar

Após criar/editar os arquivos em `src/lib/db/schema/`:

```bash
bun run db:generate    # drizzle-kit generate
bun run db:migrate     # drizzle-kit migrate (aplica em DATABASE_URL)
```

**NUNCA** rodar `drizzle-kit push` (Princípio XI). Revisar manualmente o SQL gerado antes de aplicar.

Para o banco de teste:

```bash
NODE_ENV=test bun run db:migrate   # aplica em TEST_DATABASE_URL
```

E2E reusa essa base via schema-per-worker (`audiobook_track_test`); nenhuma ação extra.

---

## 2. Subir o app em modo dev

```bash
bun run dev
```

Autenticar como admin seed e:

1. Acessar `/studios` — observar:
   - Listagem filtra `deleted_at IS NULL`.
   - Nova coluna **Livros** com contagem zero (inicialmente).
   - Excluir um estúdio agora marca `deleted_at` em vez de remover.
   - Criar estúdio com o mesmo nome de um soft-deleted → toast "desarquivado".

2. Acessar `/narrators` e `/editors` — mesmas mudanças + nova coluna **Capítulos**.

3. Acessar `/books`:
   - Tabela vazia + botão "+ Novo Livro".
   - Clicar em "+ Novo Livro" → modal abre com campos Título, Estúdio, Valor/hora, Quantidade de capítulos.
   - No seletor de Estúdio, "+ Novo Estúdio" → subformulário inline.
   - Confirmar o subformulário cria o estúdio com `default_hourly_rate = 0.01` imediatamente.
   - Confirmar o livro cria o livro + N capítulos + propaga o `price_per_hour` para o `default_hourly_rate` do estúdio inline (na mesma transação).

4. Clicar em uma linha do livro → `/books/:id`:
   - Cabeçalho com título, estúdio, R$/hora, capítulos concluídos/totais, ganho total, status, botões "Ver PDF", "Editar livro", "Excluir capítulos".
   - Tabela de capítulos com edição inline.
   - Testar `pago → concluido` (ver modal de confirmação aparecendo).
   - Entrar no modo de exclusão em lote (ícones somem, barra superior aparece).
   - Popover "Ver PDF": colar URL, salvar, abrir em nova guia.

---

## 3. Suíte de testes da feature

### Unit (rápido — cobertura de lógica pura e services)

```bash
bun run test:unit -- __tests__/unit/domain/book-status.spec.ts
bun run test:unit -- __tests__/unit/domain/chapter-state-machine.spec.ts
bun run test:unit -- __tests__/unit/services/book-service.spec.ts
bun run test:unit -- __tests__/unit/services/chapter-service.spec.ts
bun run test:unit -- __tests__/unit/services/book-status-recompute.spec.ts
bun run test:unit -- __tests__/unit/schemas
```

Ou toda a feature:

```bash
bun run test:unit -- __tests__/unit/ -t books
```

### Integration (com DB real via BEGIN/ROLLBACK)

```bash
NODE_ENV=test bun run test:integration -- __tests__/integration/book-crud.spec.ts
NODE_ENV=test bun run test:integration -- __tests__/integration/chapter-crud.spec.ts
NODE_ENV=test bun run test:integration -- __tests__/integration/soft-delete-unification.spec.ts
NODE_ENV=test bun run test:integration -- __tests__/integration/book-status-recompute.spec.ts
```

### E2E (Playwright — schema-per-worker)

```bash
bun run test:e2e -- __tests__/e2e/books-create-flow.spec.ts
bun run test:e2e -- __tests__/e2e/books-detail.spec.ts
bun run test:e2e -- __tests__/e2e/chapters-edit-inline.spec.ts
bun run test:e2e -- __tests__/e2e/chapters-bulk-delete.spec.ts
bun run test:e2e -- __tests__/e2e/book-edit-increase.spec.ts
bun run test:e2e -- __tests__/e2e/book-pdf.spec.ts
bun run test:e2e -- __tests__/e2e/soft-delete-unarchive.spec.ts
```

Durante a implementação, rodar **apenas os testes da mudança atual** (Princípio XVI). A suíte completa + lint + build só antes de abrir PR.

---

## 4. Fase final (antes de abrir PR)

Na ordem exata (Princípio XVI):

```bash
bun run lint              # zero erros e zero warnings
bun run test:unit         # toda a suíte
bun run test:integration  # toda a suíte
bun run test:e2e          # quando a mudança afeta fluxos E2E (esta feature afeta)
bun run build             # produção compila
```

Só após todas passarem, rodar `/finish-task` para PR.

---

## 5. Cenários de validação manual críticos

Durante dev, rodar mentalmente os 4 cenários abaixo — são os de maior risco:

### Cenário A — Propagação de rate para estúdio inline

1. Abrir `/books`, clicar "+ Novo Livro".
2. Em "Estúdio", escolher "+ Novo Estúdio" e criar "Teste Inline".
3. Sem preencher nada mais, verificar em `/studios` → "Teste Inline" existe com R$ 0,01.
4. Voltar ao modal, preencher valor/hora `R$ 100,00` e quantidade `3`, confirmar.
5. Verificar em `/books` → livro aparece; em `/studios` → "Teste Inline" agora tem R$ 100,00.

### Cenário B — Desarquive automático

1. Criar estúdio "ArquivarTeste" com valor/hora R$ 50,00.
2. Excluir "ArquivarTeste" em `/studios` → some da lista.
3. Criar novamente estúdio "ArquivarTeste" com valor/hora R$ 80,00.
4. Verificar: toast "desarquivado"; `default_hourly_rate` permanece R$ 50,00 (criação normal via `/studios` **preserva** rate histórico); `id` é o mesmo do original.

### Cenário C — Reversão `pago → concluido`

1. Criar livro com 1 capítulo.
2. Avançar capítulo até `pago` (atribuir narrador, horas, editor, concluir, pagar).
3. Verificar em "Editar livro" → campos "Valor/hora" e "Estúdio" bloqueados.
4. Abrir edição do capítulo, tentar status `concluido` → modal de confirmação aparece.
5. Confirmar → status volta a `concluido`; campos do capítulo voltam a ser editáveis; "Valor/hora" do livro volta a ser editável.

### Cenário D — Recomputação de `book.status` em exclusão

1. Criar livro com 2 capítulos.
2. Avançar capítulo 1 até `pago`; deixar capítulo 2 em `pendente`. `book.status` = `pendente`.
3. Excluir capítulo 2 (em modo normal, ícone excluir).
4. Após confirmar: `book.status` muda para `pago` em `/books` (sem refresh manual — resposta da API já reflete).

---

## 6. Artefatos gerados pelo `/speckit-plan`

| Arquivo | Propósito |
|---------|-----------|
| `plan.md` | Este plano técnico (resumo + constitution check + estrutura + complexity). |
| `research.md` | Decisões técnicas consolidadas dos 11 pontos da clarificação + 3 desvios. |
| `data-model.md` | Schema físico PostgreSQL: tabelas novas, migrations aditivas, invariantes. |
| `contracts/books.md` | Contrato REST de `/api/v1/books`. |
| `contracts/chapters.md` | Contrato REST de `/api/v1/chapters`. |
| `contracts/studios-delta.md` | Mudanças em `/api/v1/studios` (soft-delete + desarquive + booksCount). |
| `contracts/narrators-delta.md` | Mudanças em `/api/v1/narrators` (idem + chaptersCount). |
| `contracts/editors-delta.md` | Mudanças em `/api/v1/editors` (idem). |
| `quickstart.md` | Este arquivo. |

Próximo passo: `/speckit-tasks` para gerar a lista de tarefas ordenadas.
