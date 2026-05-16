# Contract: `nextChapterTitle` (helper puro)

**Type**: Library export (novo)
**Feature**: 026-chapter-titles-reordering
**File**: `src/lib/domain/next-chapter-title.ts`

## Signature

```ts
export function nextChapterTitle(existingTitles: readonly string[]): string;
```

## Semantics

1. Para cada string em `existingTitles`, testa o regex `/^Capítulo (\d+)$/`. Se matchear, extrai o número.
2. Retorna `Capítulo ${max + 1}`, onde `max` é o maior número extraído (0 se conjunto vazio ou sem matches).

## Examples

```ts
nextChapterTitle([])                                              // "Capítulo 1"
nextChapterTitle(["Capítulo 1", "Capítulo 2"])                    // "Capítulo 3"
nextChapterTitle(["Prólogo", "Capítulo 1", "Apresentação"])       // "Capítulo 2"
nextChapterTitle(["Capítulo 5", "Capítulo 1", "Capítulo 3"])      // "Capítulo 6"
nextChapterTitle(["Capítulo 1 — Bonus", "Capitulo 2"])            // "Capítulo 1"  (não bate regex)
nextChapterTitle(["Capítulo 9999"])                               // "Capítulo 10000"
```

## Properties / tests

- **Determinístico**: mesma entrada → mesma saída.
- **Sem dependência de I/O**: 100% puro. Testes unitários cobrem ≥ 95% de branches.
- **Regex estrito**: `^Capítulo \d+$` (exatamente "Capítulo" + espaço + dígitos + fim). Não aceita variações (`Capitulo`, `Cap.`, `Capítulo  3` com 2 espaços).
- **Não considera duplicatas existentes**: se entrada já tem `Capítulo 3` duas vezes, o próximo continua sendo `Capítulo 4` — duplicidade é decisão da camada acima (FR-006 permite duplicatas).

## Consumers

- `ChapterService.create()` chama para pré-preencher quando o cliente solicita "capítulo numerado" sem título customizado.
- Hook `use-add-chapter.ts` chama no cliente para mostrar o título sugerido no dialog antes do submit.
- `BookService.create()` usa internamente quando o usuário escolheu `numbered = N` (gera `Capítulo 1..N`).
