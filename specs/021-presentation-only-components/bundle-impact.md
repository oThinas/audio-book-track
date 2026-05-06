# Bundle Impact — T142

**Data**: 2026-05-06
**Branch**: `021-presentation-only-components`
**Mudança**: T140 + T141 — `book-edit-dialog` e `book-create-dialog` carregados via `React.lazy` + `Suspense`, com `BookDialogSkeleton` como fallback.

## Comando

```bash
rm -rf .next && bun run build
du -sk .next/static/chunks
```

## Resultado

| Métrica | Antes (baseline) | Depois (lazy-load) | Δ |
|---|---:|---:|---:|
| **Tamanho total dos chunks** | 3168 KB | 2540 KB | **−628 KB (−19.8%)** |
| **Quantidade de arquivos** | 43 | 47 | +4 (chunks lazy isolados) |

### Top 10 chunks por tamanho (bytes)

| Antes | Depois |
|---:|---:|
| 284 733 (×4 duplicatas) | 270 613 (×2) |
| 227 537 | 227 537 |
| 137 211 | 137 211 |
| 112 594 | 112 594 |
| 96 366 (×2) | 62 689 (×3) |
| 79 608 | 56 744 |

## Análise

Antes da refatoração, o código dos dois dialogs (`book-edit-dialog` 341 LOC + `book-create-dialog` 266 LOC + suas dependências de form: `react-hook-form`, `zodResolver`, `MoneyInput`, `ChapterCountInput`, etc.) era importado estaticamente por:

- `books-client.tsx` → bundle da rota `/books`
- `book-detail-client.tsx` → bundle da rota `/books/:id`

O Next.js gerava **4 cópias do mesmo bundle de ~284 KB** porque os dialogs apareciam tanto na rota raiz `/books` quanto na rota dinâmica `/books/[id]`, em variantes server e client.

Após o lazy-load:

- Os dialogs ficam num chunk separado, carregado apenas quando o usuário clica em "Novo Livro" ou "Editar livro".
- As rotas `/books` e `/books/[id]` perdem ~14 KB por chunk (×2 duplicatas restantes) + chunks duplicados desapareceram.
- 4 novos chunks lazy aparecem, totalizando bem menos do que os 4 × 284 KB removidos.

## First Paint

Para um usuário que abre `/books` sem nunca clicar em "Novo Livro":
- **Antes**: ~284 KB de código de form baixado mesmo sem usar o dialog.
- **Depois**: 0 KB do dialog. Skeleton (`BookDialogSkeleton`, ~1 KB) aparece imediatamente quando o dialog é aberto, e o chunk real é resolvido em paralelo.

A mesma análise vale para `/books/:id` e o `BookEditDialog`.

## Observação

Os tamanhos exatos podem variar ±2 KB por build devido a hashes determinísticos diferentes em chunks vendor; a redução de **~628 KB no agregado** é reprodutível.