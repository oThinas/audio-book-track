# Contract: `useRowPresence` hook

**Feature**: 037-list-row-animations · **Date**: 2026-06-18 · **Path**: `src/hooks/use-row-presence.ts`

Hook reutilizável que adiciona presença animada (entrada/saída) a uma lista mantida em estado. Não faz fetch nem toca em domínio — apenas calcula quais linhas estão `entering`/`exiting` e expõe o que a tabela precisa renderizar. Consumido por capítulos, narradores, editores e estúdios.

## Assinatura (proposta — ajustável na implementação TDD)

```ts
interface RowPresenceOptions<T> {
  /** Itens "vivos" (fonte da verdade já otimista). */
  readonly items: readonly T[];
  /** Extrai o id estável de um item (mesmo usado como React key). */
  readonly getId: (item: T) => string;
}

type RowState = "entering" | "exiting" | "idle";

interface RowPresence<T> {
  /** Itens a renderizar = vivos + em saída, com a posição preservada. */
  readonly renderItems: readonly T[];
  /** Estado de animação de uma linha pelo id. */
  readonly rowState: (id: string) => RowState;
  /**
   * Remove um item com animação de saída. Recebe o efeito otimista a executar
   * de imediato (ex.: disparar DELETE) e a função que efetiva a remoção da
   * fonte. Sob reduced-motion, remove imediatamente.
   */
  readonly remove: (id: string, commit: () => void) => void;
  /** Handler a ligar no onAnimationEnd da linha; limpa entering/exiting. */
  readonly onRowAnimationEnd: (id: string) => void;
}

declare function useRowPresence<T>(options: RowPresenceOptions<T>): RowPresence<T>;
```

> A forma exata (ex.: se `remove` recebe `commit` ou se o caminho de saída é orquestrado pelo hook de lista existente) é decidida na implementação guiada por testes. O contrato fixa o **comportamento**, não a assinatura literal.

## Comportamento garantido

1. **Sem animação na carga inicial** — ids presentes no primeiro render nunca recebem estado `entering` (FR-005).
2. **Entrada** — id que aparece em `items` após o mount inicial → `rowState(id) === "entering"` até o `onRowAnimationEnd(id)`, depois `"idle"`.
3. **Saída** — após `remove(id, commit)`, a linha permanece em `renderItems` com `rowState(id) === "exiting"` até `onRowAnimationEnd(id)`; só então sai de `renderItems`.
4. **Reduced-motion** — quando `prefers-reduced-motion: reduce`: entrada é no-op (`"idle"`) e `remove` retira a linha imediatamente, sem reter (FR-003).
5. **Rollback** — se o efeito otimista falhar, a linha em saída deve poder voltar a `idle` (a orquestração de erro fica no hook de lista; `useRowPresence` não engole erro).
6. **Posição** — linhas em saída mantêm sua posição relativa em `renderItems` durante a animação.
7. **Imutabilidade** — `renderItems` e os conjuntos retornados são novos objetos a cada mudança; nenhum parâmetro de entrada é mutado.

## Consumidores

| Lista | Hook de lista que integra | Tabela que renderiza `renderItems` |
|-------|---------------------------|-----------------------------------|
| Capítulos | `useBookDetail` (`books/hooks`) | `chapters-table.tsx` |
| Narradores | `useNarratorsList` | `narrators-table.tsx` |
| Editores | `useEditorsList` | `editors-table.tsx` |
| Estúdios | `useStudiosList` | `studios-table.tsx` |
