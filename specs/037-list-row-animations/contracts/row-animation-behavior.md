# Contract: Row Animation Behavior (UI)

**Feature**: 037-list-row-animations · **Date**: 2026-06-18

Contrato observável de comportamento das quatro listagens (capítulos, narradores, editores, estúdios). Define o "o quê" verificável; o "como" está no `plan.md`/`research.md`.

## Gatilhos

| Evento | Comportamento esperado |
|--------|------------------------|
| Item criado/confirmado (sucesso) | A **nova** linha entra com transição (`animate-in fade-in slide-in-from-top`, ≤ 300 ms) e permanece na posição final. |
| Item removido (individual) | A linha aplica `animate-out fade-out slide-out-to-top` e **só então** é retirada do render. |
| Capítulos removidos em massa (bulk-delete) | Todas as linhas selecionadas animam a saída (simultaneamente) antes de sair do render. |
| Carga inicial da lista / navegação / `router.refresh()` | **Nenhuma** linha existente anima (FR-005). |
| Reordenação de capítulos (↑/↓ ou drag) | **Nenhuma** animação de entrada/saída; movimento permanece neutro (FR-006). |
| Desarquive por colisão de nome (estúdio/narrador/editor) | A linha reaparecida conta como **entrada** e anima como tal. |

## Reduced motion (FR-003)

- Com `prefers-reduced-motion: reduce`: **nenhuma** animação. Criação aplica a linha instantaneamente; remoção retira a linha imediatamente (sem reter). Verificável por `page.emulateMedia({ reducedMotion: 'reduce' })`.

## Tema (FR-004)

- Entrada/saída visualmente corretas em tema claro **e** escuro. Como só `opacity`/`transform` são animados (sem cor), não há flash de cor; nenhuma cor hardcoded é introduzida.

## Falha (FR-007)

- Se a criação falhar, nenhuma linha "fantasma" permanece. Se a remoção falhar, a linha em saída é reinserida (rollback) e a lista reflete o estado real.

## Marcador de estado (para teste)

- Cada linha animável expõe `data-row-state` ∈ `{ "entering", "exiting", "idle" }`. `role`/estrutura da linha **não** mudam (selectores `getByRole`/`data-testid` existentes continuam válidos).

## Performance (SC-004, SC-007)

- Cada transição conclui em ≤ 300 ms e usa apenas propriedades compositor-friendly (`opacity`/`transform`); largura/altura da linha não são animadas.

## Consistência (FR-009)

- Estilo e duração idênticos entre as quatro listagens.
