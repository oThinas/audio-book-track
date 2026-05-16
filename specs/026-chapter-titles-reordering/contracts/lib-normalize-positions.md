# Contract: `densifyPositions` (helper puro)

**Type**: Library export (novo)
**Feature**: 026-chapter-titles-reordering
**File**: `src/lib/domain/normalize-positions.ts`

## Signature

```ts
export function densifyPositions<T extends { id: string }>(
  ordered: readonly T[],
): ReadonlyArray<{ id: string; position: number }>;
```

## Semantics

Recebe uma lista ordenada (na ordem desejada) e retorna pares `{ id, position }` com `position` começando em 0, incrementando 1 a 1. Não toca em outros campos do item.

## Examples

```ts
densifyPositions([])
// → []

densifyPositions([{ id: "a" }, { id: "b" }, { id: "c" }])
// → [{ id: "a", position: 0 }, { id: "b", position: 1 }, { id: "c", position: 2 }]

// Tipo genérico mantém campos extras (sem alterá-los):
densifyPositions([{ id: "a", title: "X" }, { id: "b", title: "Y" }])
// → [{ id: "a", position: 0 }, { id: "b", position: 1 }]
```

## Properties / tests

- **Pura, determinística**. Sem I/O, sem mutação do input.
- **Preserva ordem**: o N-ésimo item de saída corresponde ao N-ésimo do input.
- **Posições densas**: sempre `0..ordered.length-1`. Verificável com `result.every((r, i) => r.position === i)`.
- **Não detecta duplicatas de id**: chamador é responsável por garantir IDs únicos (já validados no schema Zod do reorder).

## Consumers

- `ChapterService.reorder()` — converte `orderedIds` em pares `{id, position}` para passar ao repositório.
- `ChapterService.create()` — após decidir onde inserir, gera positions de todos os capítulos do livro densificadamente.
- `BookService.create()` — gera positions iniciais para numerados + extras.

## Why a helper

Centralizar a invariante "positions são densas 0..N-1" em um único helper torna a propriedade auditável em testes e elimina drift entre os três call-sites acima.
