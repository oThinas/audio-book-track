# Data Model: List Row Enter/Exit Animations (Fase A)

**Feature**: 037-list-row-animations · **Date**: 2026-06-18

## Persistência

**Nenhuma.** Esta feature é puramente de apresentação: não cria nem altera tabelas, colunas, repositories ou services. Não há mudança de schema, migration ou contrato de API.

## Modelo client-side: estado de presença

O único "modelo" é o estado efêmero de presença das linhas, mantido em memória pelo hook `useRowPresence` (ver [contracts/use-row-presence.md](./contracts/use-row-presence.md)). Não é persistido nem trafega pela rede.

### Estado interno do hook

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `initialIds` | `ReadonlySet<string>` (ref) | Ids presentes no primeiro render. Linhas neste conjunto **não** animam entrada (FR-005). |
| `enteringIds` | `ReadonlySet<string>` (state) | Ids que apareceram após o mount inicial. Recebem `animate-in`. Limpos individualmente no `onAnimationEnd`. |
| `exitingRows` | `ReadonlyArray<{ item: T; index: number }>` (state) | Linhas removidas da fonte, mantidas no render com `animate-out` até o `onAnimationEnd`. `index` preserva a posição visual durante a saída. |
| `prefersReducedMotion` | `boolean` (state) | Espelha `matchMedia('(prefers-reduced-motion: reduce)')`. Quando `true`: entrada é no-op e saída é imediata (FR-003). |

### Derivações

| Derivação | Fórmula | Uso |
|-----------|---------|-----|
| `renderItems` | merge de `liveItems` + `exitingRows` reinseridos em `index` | Lista que a tabela renderiza (live + exiting). |
| `rowState(id)` | `exiting` se em `exitingRows`; `entering` se em `enteringIds`; senão `idle` | Seleciona a classe e o `data-row-state` da linha. |

### Invariantes

- Um id nunca está simultaneamente em `enteringIds` e `exitingRows`.
- `exitingRows` é esvaziado: cada linha sai no seu `onAnimationEnd` (ou imediatamente sob reduced-motion / em rollback).
- `initialIds` é imutável após o primeiro render (não cresce com novas inserções).
- Sob `prefersReducedMotion`, `enteringIds` e `exitingRows` permanecem vazios (caminho instantâneo).

## Entidades de domínio afetadas (apenas como fonte da lista)

As entidades a seguir **não mudam**; aparecem só para situar quais listas a feature cobre. Cada linha é identificada por `id` estável (já usado como `key`).

| Listagem | Entidade fonte | Identificador da linha |
|----------|----------------|------------------------|
| Capítulos (detalhe do livro) | `Chapter` | `chapter.id` |
| Narradores | `NarratorListItem` | `id` |
| Editores | `EditorListItem` | `id` |
| Estúdios | `StudioListItem` | `id` |
