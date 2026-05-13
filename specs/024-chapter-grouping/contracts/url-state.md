# URL State Contract — `?groupBy`

**Feature**: 024 Chapter Grouping
**Scope**: Search param adicionado à rota `/books/:id`.

---

## Contract

| Aspecto | Valor |
|---|---|
| Rota afetada | `GET /books/:id` (página de detalhe do livro) |
| Param | `groupBy` |
| Tipo | string opcional |
| Default (ausente) | tabela renderiza flat |
| Aceita | lista CSV ordenada de dimensões: `narrator`, `editor`, `status` |
| Rejeita silenciosamente (renderiza flat e remove param) | tokens desconhecidos, duplicatas, espaços, vírgulas extras |

### Exemplos válidos

```
/books/abc-123                                  → flat
/books/abc-123?groupBy=narrator                 → grupo por narrador
/books/abc-123?groupBy=editor                   → grupo por editor
/books/abc-123?groupBy=status                   → grupo por status
/books/abc-123?groupBy=narrator,editor          → hierarquia narrador → editor
/books/abc-123?groupBy=narrator,editor,status   → hierarquia narrador → editor → status
/books/abc-123?groupBy=status,narrator          → hierarquia status → narrador (ordem importa)
```

### Exemplos inválidos (caem para flat; param removido)

```
/books/abc-123?groupBy=foo                      → token desconhecido
/books/abc-123?groupBy=narrator,narrator        → duplicata
/books/abc-123?groupBy=narrator;editor          → separador errado
/books/abc-123?groupBy=                         → vazio
```

### Convivência com outros params

`groupBy` é independente de quaisquer outros search params da rota. Mudanças em `groupBy` preservam todos os demais (`URLSearchParams.set("groupBy", ...)`, `delete("groupBy")`).

### Comportamento de cache / navegação

- Atualização via `router.replace(..., { scroll: false })` — sem reload, sem push novo no histórico, sem refetch dos dados do livro.
- Compartilhar a URL recria o estado de agrupamento exato.
- Estado de expansão dos grupos NÃO está na URL.

---

## Test cases (referência para tests/e2e e tests/unit)

| ID | Input | Expected `grouping` state | Expected URL após render |
|---|---|---|---|
| U-1 | `null` (sem param) | `[]` | sem mudança |
| U-2 | `"narrator"` | `["narrator"]` | `?groupBy=narrator` |
| U-3 | `"narrator,editor"` | `["narrator","editor"]` | `?groupBy=narrator,editor` |
| U-4 | `"editor,narrator"` | `["editor","narrator"]` | `?groupBy=editor,narrator` |
| U-5 | `"foo"` | `[]` | param removido |
| U-6 | `"narrator,foo"` | `[]` | param removido |
| U-7 | `"narrator,narrator"` | `[]` | param removido |
| U-8 | `""` | `[]` | param removido |
| U-9 | `"narrator,editor,status"` | `["narrator","editor","status"]` | `?groupBy=narrator,editor,status` |

Esses casos são a base para `__tests__/unit/components/features/chapters/grouping-param.spec.ts`.
