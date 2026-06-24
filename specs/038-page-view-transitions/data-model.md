# Phase 1 — Data Model: Animações de transição entre páginas

**Feature**: 038-page-view-transitions

## Entidades de domínio

**Nenhuma.** Esta é uma feature puramente de apresentação. Não há novas tabelas, colunas, migrations, repositórios ou serviços. Nenhuma entidade existente (`studio`, `book`, `chapter`, `narrator`, `editor`, `user_preference`) é modificada. A reordenação de capítulos reaproveita a persistência já existente (`PUT /api/v1/books/:bookId/chapters/order`, feature 026) — esta feature apenas anima o reposicionamento, sem alterar o contrato.

## Estado efêmero (client / derivado de rota)

Os únicos "estados" relevantes são de UI, não persistidos:

| Estado | Origem | Onde vive | Observações |
|--------|--------|-----------|-------------|
| Rota atual (`pathname`) | `usePathname()` | já existente | Entrada do helper de direção. |
| Transition type da navegação | derivado puro `resolveNavTransition(from, to)` | helper `src/lib/navigation/nav-transition.ts` | Valores: `nav-up` \| `nav-down` \| `depth-forward` \| `depth-back` \| `none`. Sem estado mutável — função pura. |
| Modal de settings aberto | **derivado da URL** (rota interceptada `(.)settings`) | árvore de rotas (`@modal`) | NÃO é `useState` de domínio; a presença do modal é função da rota (Princípio VII). |
| Ordem otimista de capítulos | já existente (`useChaptersReorder`) | hook co-localizado | Sem campo novo; apenas a atualização passa a ocorrer dentro de `startTransition` para o morph. |

## Vocabulário canônico (transition types)

Definido no contrato de UI ([contracts/ui-contracts.md](./contracts/ui-contracts.md)). Resumo:

- `nav-up` / `nav-down` — eixo vertical, entre seções de topo, pela ordem de `NAV_ITEMS`.
- `depth-forward` / `depth-back` — eixo horizontal, lista↔detalhe.
- `none` — crossfade neutro (default / caso não classificado).

A ordem canônica do menu (`src/lib/constants/navigation.ts`) é a fonte de verdade para a comparação vertical: `dashboard(0) → books(1) → studios(2) → editors(3) → narrators(4)`. `settings` (BOTTOM_ITEMS) não participa do eixo vertical — vira modal.
