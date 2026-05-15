# Quickstart: Chapter titles, reordering, and extra-chapter templates

**Feature**: 026-chapter-titles-reordering
**Date**: 2026-05-15

Roteiro de verificação manual + diretrizes de testes automatizados. Use após aplicar a migration e implementar o código.

---

## Setup

```bash
# Aplicar a migration nova
bun run db:generate              # gera 0008_chapter_title_position_book_version.sql
# Editar manualmente o .sql para usar DEFERRABLE INITIALLY DEFERRED no índice unique
bun run db:migrate

# Reset e seed do banco de desenvolvimento
bun run db:test:reset            # opcional, só em dev local

# Rodar app local
bun run dev
```

Para testar com base limpa:

```bash
bun run db:test:clean-orphans    # remove schemas E2E órfãos
```

---

## Roteiro manual

### Cenário 1: Migração preserva ordem visual

1. **Antes da migration**: ter pelo menos um livro com `[Capítulo 1, Capítulo 2, Capítulo 3]` e um com gaps (`[Capítulo 1, Capítulo 4, Capítulo 7]` — pode criar deletando capítulos no meio antes de migrar).
2. Aplicar migration.
3. Conferir via SQL:

```sql
SELECT id, title, position FROM chapter WHERE book_id = '<id>' ORDER BY position;
```

**Esperado.** Livro contíguo: `title=Capítulo 1/2/3`, `position=0/1/2`. Livro com gaps: `title=Capítulo 1/Capítulo 4/Capítulo 7`, `position=0/1/2` (positions densificadas; títulos preservam o legado).

4. Conferir invariante:

```sql
SELECT book_id, MIN(position), MAX(position), COUNT(*)
FROM chapter GROUP BY book_id
HAVING MIN(position) <> 0 OR MAX(position) <> COUNT(*) - 1;
```

**Esperado.** Zero linhas (todas as positions são densas).

### Cenário 2: Adicionar Prólogo a um livro existente

1. Abrir `/books/<id>` (livro com 3 capítulos numerados).
2. Clicar em "+ Adicionar capítulo".
3. Selecionar "Prólogo (template)", deixar posição como "No início".
4. Clicar "Adicionar".

**Esperado.** Tabela mostra `[Prólogo, Capítulo 1, Capítulo 2, Capítulo 3]`. Positions persistidas: `0, 1, 2, 3`. Toast de confirmação **não** aparece (decisão de UI do projeto — `toast.success` é proibido).

### Cenário 3: Reordenar via drag-and-drop

1. Em `/books/<id>` com `[Capítulo 1, Capítulo 2, Capítulo 3, Capítulo 4]`.
2. Arrastar a linha "Capítulo 4" para o topo.

**Esperado.**
- Tabela renderiza imediatamente como `[Capítulo 4, Capítulo 1, Capítulo 2, Capítulo 3]` (mutação otimista).
- Network: `PUT /api/v1/books/<id>/chapters/order` retorna 200.
- Recarregar a página confirma a nova ordem.

3. Forçar conflito: abrir DevTools, fazer `fetch("/api/v1/books/<id>/chapters/order", { method: "PUT", body: JSON.stringify({ orderedIds: [...stale order...], expectedVersion: 0 }) })`.

**Esperado.** 409 `BOOK_CHAPTERS_VERSION_CONFLICT` + toast PT-BR "Outro usuário alterou os capítulos…".

### Cenário 4: Reordenar via teclado

1. Em `/books/<id>`, dar `Tab` até focar em "Capítulo 3".
2. Pressionar `Space` (entra em modo drag).
3. `↑` `↑` até subir 2 posições.
4. `Space` solta.

**Esperado.** Capítulo movido. `aria-live` anuncia "Capítulo 3 moved to position 1 of 4" (em PT-BR, configurar `accessibility.announcements` do `@dnd-kit`).

### Cenário 5: Botões ↑/↓ em mobile

1. Em viewport mobile (Chrome DevTools → iPhone 14), abrir `/books/<id>`.
2. Tocar no botão `↑` da linha "Capítulo 3".

**Esperado.** Linha sobe uma posição. Sem conflito com scroll vertical.

### Cenário 6: Reorder de capítulo `paid`

1. Marcar um capítulo como `paid` via UI (passar por `editing → reviewing → completed → paid`).
2. Arrastar o capítulo `paid` para outra posição.

**Esperado.** Reorder aceito. Capítulo `paid` mantém todos os campos financeiros intocados. Apenas a posição mudou. Conferir via SQL: `edited_seconds`, `narrator_id`, `editor_id`, `status` permanecem.

### Cenário 7: Editar título em capítulo `paid`

1. Em capítulo `paid`, abrir modo edição da linha.
2. Tentar editar `title`.

**Esperado.** Campo desabilitado. Tentar via API (`PATCH /chapters/:id` com `{title: "Novo"}`) → 409 `CHAPTER_PAID_LOCKED`.

### Cenário 8: Validação de título

| Input | Resultado |
|-------|-----------|
| `""` | Erro 422 "Título é obrigatório" |
| `"   "` (espaços) | Erro 422 "Título é obrigatório" (após trim) |
| 101 chars | Erro 422 "Título deve ter no máximo 100 caracteres" |
| `"Linha 1\nLinha 2"` | Erro 422 "Título não pode ter quebras de linha" |
| `"😎 Capítulo 1"` | Aceito |
| `"Bonjour — Première étape"` | Aceito |

### Cenário 9: Criação de livro com extras

1. Abrir "+ Novo livro" no `/books`.
2. Preencher título, estúdio, preço/hora.
3. Definir "Capítulos numerados: 5".
4. Adicionar extras:
   - Prólogo (no início)
   - Apresentação (no início)
   - Epílogo (no fim)
5. Salvar.

**Esperado.** Livro nasce com 8 capítulos:
- `position=0`: Apresentação *(último start na lista)*
- `position=1`: Prólogo
- `position=2..6`: Capítulo 1..5
- `position=7`: Epílogo

### Cenário 10: Próximo número numerado

1. Livro com `[Capítulo 1, Prólogo, Capítulo 2]`.
2. Abrir "+ Adicionar capítulo", selecionar "Capítulo numerado".

**Esperado.** Sugestão de título: `"Capítulo 3"` (ignora Prólogo).

3. Renomear sugestão para "Capítulo 5".
4. Salvar.
5. Adicionar outro "Capítulo numerado".

**Esperado.** Sugestão: `"Capítulo 6"`.

---

## Plano de testes automatizados

### Unit (`__tests__/unit/`)

| Spec | Cobertura |
|------|-----------|
| `lib/domain/chapter-title.spec.ts` | Valida trim, max 100, rejeição de `\n`/`\r`, empty. 100%. |
| `lib/domain/next-chapter-title.spec.ts` | Padrão regex, ignora templates, conjunto vazio, mistura. 100%. |
| `lib/domain/normalize-positions.spec.ts` | Densificação, ordem preservada, vazio, n=1. 100%. |
| `lib/domain/chapter.spec.ts` | `PAID_LOCKED_FIELDS` inclui `title`. |
| `lib/schemas/update-chapter.spec.ts` | `title` aceita, rejeita inválidos. |
| `lib/schemas/create-chapter.spec.ts` | Posição enum, `after: uuid`, `expectedVersion`. |
| `lib/schemas/reorder-chapters.spec.ts` | Array de uuids, sem duplicatas, com `expectedVersion`. |
| `lib/schemas/create-book.spec.ts` | `chaptersInput` discriminated union; constraint `numbered + extras > 0`. |
| `components/features/chapters/hooks/use-chapters-reorder.spec.tsx` | Aplica nova ordem otimisticamente, reverte em erro, propaga `chaptersVersion` no sucesso. |
| `components/features/chapters/hooks/use-add-chapter.spec.tsx` | Submit OK, 409 fecha + revalida, 422 mostra erro no form. |

### Integration (`__tests__/integration/`)

| Spec | Cobertura |
|------|-----------|
| `repositories/drizzle-chapter-title-position.spec.ts` | Insert com title/position; listByBookId ordenado por position. |
| `repositories/drizzle-chapter-reorder.spec.ts` | Permutação completa em uma transação, DEFERRABLE funciona, densidade mantida. |
| `services/chapter-service-title.spec.ts` | Title em update; paid lock; trim/length/newline. |
| `services/chapter-service-create.spec.ts` | Insere em start/end/after; bumpa `chapters_version`; densifica positions; 422 em after-id inválido. |
| `services/chapter-service-reorder.spec.ts` | Reorder OK; reorder com paid OK; 409 expectedVersion divergente; 422 orderedIds mismatch. |
| `services/book-service-create-with-extras.spec.ts` | Criação atômica com numbered + extras; ordem final correta; rollback em erro. |

### E2E (`__tests__/e2e/`)

| Spec | Cobertura |
|------|-----------|
| `chapter-titles-and-reorder.spec.ts` | Smoke completo: criar livro com extras, renomear via UI, arrastar via mouse, verificar persistência após reload, editar título de capítulo paid (bloqueado), conflito 409 simulado por dois clientes. |

### Cobertura

- Helpers puros (`chapter-title`, `next-chapter-title`, `normalize-positions`): **100%**.
- Service layer: ≥ 90%.
- Repository: ≥ 85%.
- Hooks: ≥ 80%.
- Total feature: ≥ 80% (constituição).

---

## Verificação final (antes do PR)

```bash
bun run lint                    # zero erros e warnings
bun run test:unit
bun run test:integration
bun run test:e2e                # full suite, schema-per-worker
bun run build                   # production compila
```

Checklist constitucional rápida (mais detalhada em `checklists/requirements.md`):

- [ ] Operações no nível do capítulo (Princípio I)
- [ ] Cálculos financeiros não tocados (Princípio II)
- [ ] Ciclo de vida do capítulo intacto (Princípio III)
- [ ] Sem features extras além do escopo (Princípio IV)
- [ ] TDD seguido em todos os novos arquivos (Princípio V)
- [ ] Camadas: schema → domain → ports → adapters → service → factory → route (Princípio VI)
- [ ] Componentes puramente apresentacionais + hooks co-localizados (Princípio VII)
- [ ] Sem peso desnecessário no client (Princípio VIII)
- [ ] Sem cores hardcoded; dark mode coberto (Princípio IX)
- [ ] REST: plural kebab-case, status codes corretos, envelope (Princípio X)
- [ ] PostgreSQL: índices em FK, sem `SELECT *`, migration reversível (Princípio XI)
- [ ] Sem anti-padrões (Princípio XII)
- [ ] Context7 MCP consultado para `@dnd-kit/sortable` + Drizzle DEFERRABLE; design.pen consultado (Princípio XV)
- [ ] Verificação final (lint + testes + build) executada (Princípio XVI)
