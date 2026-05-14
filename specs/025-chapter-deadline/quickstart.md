# Quickstart: Data Limite por Capítulo (025)

**Feature**: 025-chapter-deadline
**Branch**: `025-chapter-deadline`

Documento de bolso para qualquer pessoa entrar nesta feature: o que está sendo construído, como rodar localmente, como testar manualmente, e como verificar quando estiver pronto.

---

## TL;DR

> Capítulo ganha um prazo opcional. Capítulo atrasado em status de ação aparece destacado. Toggle "Foco da semana" mostra só o que precisa de ação esta semana civil (atrasados + prazos dentro da semana, em capítulos `pending`/`editing`/`reviewing`/`retake`). Em `/books`, uma nova coluna "Foco" exibe uma badge com a contagem desses capítulos por livro.

---

## Setup local

```bash
# Banco principal
bun run db:migrate                # aplica 0007_chapter_deadline.sql

# Banco de teste
bun run db:test:migrate           # idem para audiobook_track_test

# Dev server
bun run dev                       # localhost:3000
```

**Pré-requisito**: PostgreSQL rodando, `.env.local` configurado.

---

## Walkthrough manual (UI)

### 1. Definir prazo de um capítulo

1. Abra `/books` e clique em um livro.
2. Em uma linha de capítulo (status diferente de `paid`), clique em "Editar" (ou o controle equivalente do row edit mode).
3. No form expandido, localize o controle **"Prazo"** (label novo).
4. Clique no botão `Definir prazo` → popover do calendário abre.
5. Escolha uma data futura, clique em `OK`, salve a linha.
6. A célula da coluna **"Prazo"** mostra `DD/MM/YYYY`. Hover exibe tooltip "em N dias".

### 2. Marcar como atrasado

1. Repita o passo 1.
2. No calendário, navegue para uma data anterior à de hoje. Selecione, salve.
3. A célula passa a exibir a data em vermelho, com ícone de alerta ao lado. Hover exibe "Atrasado há N dias".
4. Mude o status do capítulo para `completed`. O destaque some.

### 3. Limpar prazo

1. Abrir modo edição em capítulo com prazo.
2. Abrir o picker, clicar em **"Limpar"** no footer do popover, salvar.
3. Célula volta a exibir `—`.

### 4. Filtro "Foco da semana"

1. Na tela do livro com capítulos variados (alguns atrasados, alguns na semana, alguns `paid`, alguns sem prazo), clique no botão **"Foco da semana"** na barra de ações da tabela.
2. URL muda para `?focus=week`.
3. Tabela esconde capítulos `completed`, `paid`, sem prazo, ou com prazo fora da semana e não atrasados.
4. Copie a URL e abra em outra aba → o filtro vem ligado.
5. Clique novamente no botão → filtro desliga; URL perde `?focus=week`.

### 5. Coluna "Foco" em `/books`

1. Crie um livro com 3 capítulos: 1 atrasado em `pending`, 1 dentro da semana em `editing`, 1 `paid`.
2. Volte para `/books`.
3. Na linha desse livro, a célula da coluna "Foco" mostra a badge **"Foco da semana · 2"** (apenas os 2 primeiros entram).
4. Edite e mova o atrasado para `completed`. Volte para `/books`. A badge agora mostra **"Foco da semana · 1"**.

### 6. Bloqueio em `paid`

1. Marque um capítulo como `paid` (usando o fluxo existente).
2. Abra o modo edição da linha. O picker de prazo aparece desabilitado.
3. Tente patchar via API: `PATCH /api/v1/chapters/:id` com `{ deadline: "2026-06-01" }`. Resposta: `409 CHAPTER_PAID_LOCKED`.

---

## Test cookbook

### Rodar tudo (fase final, antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

### Rodar só o que mexe (durante TDD)

```bash
bun vitest run __tests__/unit/lib/domain/chapter-deadline.spec.ts
bun vitest run __tests__/integration/repositories/drizzle-chapter-deadline.spec.ts
bun vitest run __tests__/integration/services/chapter-service-deadline.spec.ts
bunx playwright test __tests__/e2e/chapter-deadline.spec.ts
```

### Forjando "hoje" em testes

```ts
import { todayInAppTimezone } from "@/lib/domain/timezone";

const fixedNow = () => new Date("2026-05-14T12:00:00.000Z");
const today = todayInAppTimezone(fixedNow); // "2026-05-14"
```

Nunca usar `vi.useFakeTimers()` global — o helper recebe a função `now` como injeção. Mantém o teste puro.

---

## Pontos de atenção (gotchas)

1. **Off-by-one por fuso**: Drizzle `date` está em `mode: "string"` para isso. Se você vir uma data deslocada em ±1 dia em qualquer lugar, suspeite de `new Date(iso).toISOString()` (faz conversão para UTC). Use as funções do `format-date.ts`.
2. **Semana começa segunda-feira**: `weekStartsOn: 1` em `startOfWeek`/`endOfWeek`/`Calendar`. Não confiar no locale do servidor — sempre passar explicitamente.
3. **Capítulo `paid` não diz "está bloqueado" por tooltip**: o picker fica `disabled`, consistente com os demais campos `paid`-locked existentes. Não inventar tooltip novo.
4. **Mudança de dia durante sessão**: se o gestor mantém a página aberta a noite toda, "hoje" pode mudar. A spec aceita: o usuário recarrega manualmente. Não implementar polling.
5. **Badge não decrementa em real-time**: ela vem do servidor a cada listagem `/books`. Mudou capítulo? Volte para `/books` (Next.js refaz o RSC). Não há subscription/websocket.

---

## Definition of Done

- [ ] Migration `0007_chapter_deadline.sql` aplicada local e em teste.
- [ ] `PAID_LOCKED_FIELDS` atualizado em domínio E service.
- [ ] `BookSummary.focusThisWeekCount` calculado em single query.
- [ ] `/api/v1/chapters/:id` aceita e retorna `deadline`.
- [ ] `/api/v1/books` retorna `focusThisWeekCount` em cada item.
- [ ] Coluna "Prazo" visível em `/books/:id`, sem header de ordenação.
- [ ] Picker shadcn Calendar pt-BR, com "Limpar".
- [ ] Toggle "Foco da semana" filtra + reflete na URL + sobrevive reload.
- [ ] Coluna "Foco" em `/books` (entre "Capítulos" e "Status") com badge "Foco da semana · N" quando N > 0, vazia quando N = 0.
- [ ] Catálogo de erros atualizado (`CHAPTER_PAID_LOCKED` reformulado).
- [ ] Testes unit + integration + E2E verdes; coverage ≥ 80%.
- [ ] `bun run lint && bun run build` limpos.
- [ ] Dark mode validado em todos os artefatos visuais novos.
- [ ] `design.pen` consultado e respeitado para coluna, picker, toggle, badge.
