# Tasks: Pagina 404 Personalizada

**Input**: Design documents from `/specs/014-custom-404-page/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Incluidos — TDD e obrigatorio pela constituicao (Principio V).

**Organization**: Tasks agrupadas por user story para implementacao e teste independentes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Pode rodar em paralelo (arquivos diferentes, sem dependencias)
- **[Story]**: User story associada (US1, US2)
- Caminhos de arquivo incluidos nas descricoes

---

## Phase 1: Setup

**Purpose**: Nenhuma configuracao de projeto necessaria — o projeto ja existe com todas as dependencias instaladas.

Fase vazia — sem tarefas de setup. O projeto ja tem Next.js, shadcn/ui, lucide-react, Tailwind, Vitest e Playwright configurados.

**Checkpoint**: Projeto pronto para implementacao.

---

## Phase 2: Foundational (Constantes compartilhadas)

**Purpose**: Criar o array de mensagens que ambas as user stories dependem.

### Tests

> **NOTE: Escrever testes PRIMEIRO, garantir que FALHAM antes da implementacao**

- [x] T001 Escrever testes unitarios para o array de mensagens em `__tests__/unit/constants/not-found-messages.test.ts` — validar que o array exportado tem no minimo 5 itens, que todos sao strings nao-vazias, e que nao ha duplicatas

### Implementation

- [x] T002 Criar array constante de mensagens humoristicas em `src/lib/constants/not-found-messages.ts` — exportar `NOT_FOUND_MESSAGES` como `readonly string[]` com 7 frases tematicas de audiobooks/narracao conforme definidas no plan.md

**Checkpoint**: Testes unitarios passando. Array de mensagens validado.

**Quality Gate**: `bun run lint` e `bun run test:unit` devem passar sem erros ou warnings.

---

## Phase 3: User Story 1 - Pagina 404 com humor tematico (Priority: P1)

**Goal**: Pagina 404 personalizada com mensagem tematica, botao de navegacao, dark mode e responsividade.

**Independent Test**: Acessar qualquer rota inexistente no browser e verificar que a pagina 404 customizada aparece com mensagem, botao funcional, e adaptacao a dark/light mode.

### Tests for User Story 1

> **NOTE: Escrever testes PRIMEIRO, garantir que FALHAM antes da implementacao**

- [x] T003 [US1] Escrever teste E2E em `__tests__/e2e/not-found.spec.ts` — verificar que: (1) acessar rota inexistente exibe o texto "404", (2) uma mensagem do array e visivel, (3) botao "Voltar ao inicio" existe e redireciona para "/", (4) pagina funciona em viewport mobile (375px) e desktop (1440px)

### Implementation for User Story 1

- [x] T004 [US1] Criar `src/app/not-found.tsx` como Server Component — layout centralizado com: icone lucide-react (`BookOpen`), texto "404" em destaque, mensagem aleatoria do array, subtitulo "A pagina que voce procura nao foi encontrada.", e `<Link>` com `buttonVariants` para "Voltar ao inicio". Tokens semanticos para todas as cores. Mobile first.

**Checkpoint**: Pagina 404 renderiza com mensagem fixa, botao funcional, dark mode e responsividade. Teste E2E parcialmente passando (mensagem fixa ok).

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:e2e` e `bun run build` devem passar.

---

## Phase 4: User Story 2 - Mensagem variada a cada visita (Priority: P2)

**Goal**: Selecao aleatoria de mensagem a cada renderizacao no servidor.

**Independent Test**: Recarregar a pagina 404 multiplas vezes e verificar que mensagens diferentes aparecem.

### Implementation for User Story 2

- [x] T005 [US2] Atualizar `src/app/not-found.tsx` para selecionar mensagem aleatoriamente via `Math.random()` do array `NOT_FOUND_MESSAGES` em vez de usar a primeira mensagem fixa (implementado junto com T004)

### Tests for User Story 2

- [x] T006 [US2] Atualizar teste E2E em `__tests__/e2e/not-found.spec.ts` — cenario de validacao contra conjunto conhecido ja incluso no T003 (E2E nao executado — Docker/DB offline)

**Checkpoint**: Mensagens variam a cada visita. Todos os testes passando.

**Quality Gate**: `bun run lint`, `bun run test:unit`, `bun run test:e2e` e `bun run build` devem passar.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Verificacao final e validacao de qualidade.

- [x] T007 Rodar validacao completa: `bun run lint`, `bun run test:unit`, `bun run build` — passando. `bun run test:e2e` bloqueado (Docker/DB offline)
- [ ] T008 Teste manual seguindo quickstart.md: acessar rota inexistente em modo claro e escuro, viewport mobile e desktop, verificar botao de navegacao

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Vazia — sem dependencias.
- **Phase 2 (Foundational)**: Pode iniciar imediatamente. Cria o array de mensagens que ambas as stories usam.
- **Phase 3 (US1)**: Depende da Phase 2 (array de mensagens).
- **Phase 4 (US2)**: Depende da Phase 3 (pagina 404 ja existindo).
- **Phase 5 (Polish)**: Depende de todas as phases anteriores.

### User Story Dependencies

- **User Story 1 (P1)**: Depende apenas da Phase 2 (constantes).
- **User Story 2 (P2)**: Depende da US1 (modifica o mesmo arquivo `not-found.tsx`).

### Within Each Phase

- Testes escritos e falhando ANTES da implementacao (TDD).
- Verificacao de qualidade ao final de cada phase.

### Parallel Opportunities

- T001 (teste) pode ser escrito em paralelo com o design da pagina (nao com T002).
- T003 (E2E) pode ser escrito enquanto T002 e implementado (teste vai falhar ate T004).
- T005 e T006 operam no mesmo arquivo — sequenciais.

---

## Parallel Example: Phase 2

```bash
# Sequencial — teste primeiro, depois implementacao:
Task T001: "Testes unitarios para not-found-messages"
Task T002: "Implementar array de mensagens" (depende de T001 falhar primeiro)
```

## Parallel Example: Phase 3

```bash
# Sequencial — E2E primeiro, depois implementacao:
Task T003: "E2E teste da pagina 404"
Task T004: "Implementar not-found.tsx" (depende de T003 falhar primeiro)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 2: Criar array de mensagens (TDD)
2. Phase 3: Criar pagina 404 com mensagem fixa (TDD)
3. **STOP e VALIDAR**: Testar pagina 404 no browser
4. Feature funcional com mensagem fixa — ja entrega valor

### Incremental Delivery

1. Phase 2 → Constantes prontas
2. Phase 3 (US1) → Pagina 404 funcional com mensagem fixa → Testavel
3. Phase 4 (US2) → Adicionar aleatoriedade → Testavel
4. Phase 5 → Verificacao final e polish

---

## Notes

- Feature simples: 8 tarefas totais, ~2 arquivos de producao, ~2 arquivos de teste
- TDD obrigatorio (constituicao Principio V)
- Server Component puro — zero impacto no bundle do cliente
- Todas as cores via design tokens — dark mode automatico
- Mobile first — layout centralizado funciona em qualquer viewport
