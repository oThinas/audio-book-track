# Quickstart: Skeletons de Carregamento nas Rotas Autenticadas

**Feature**: 031-route-loading-skeletons

## Ver os skeletons em desenvolvimento

```bash
bun dev
```

1. Logado em qualquer rota, abra o **Next.js DevTools** (indicador no canto da tela) → segment explorer → ative o preview do `loading.tsx` da rota atual.
2. Repita para: `/books`, `/narrators`, `/editors`, `/studios`, `/settings` e o detalhe de um livro.
3. Esperado por página:
   - **Listagens**: título/descrição/botão (e busca, apenas em `/books`) reais e desabilitados + bloco pulsante na região da tabela.
   - **Detalhe do livro**: 3 barras (título, meta, stats) + bloco único abaixo.
   - **Configurações**: título real + 2 blocos.

> **Por que não throttling de rede?** Em produção, o Next 16 prefetcha o conteúdo dinâmico completo enquanto o usuário está na página de origem — ao clicar, a navegação é servida do segment cache e a janela de loading não aparece, mesmo com Slow 4G. O comportamento temporal real (skeleton durante a navegação → swap) é coberto pelo E2E determinístico (atraso server-side, ver research R6). Em rede realmente lenta com cache frio, um flash breve do skeleton é esperado e aceito.

## Verificar movimento reduzido

DevTools → Rendering → "Emulate CSS media feature prefers-reduced-motion: reduce" → blocos ficam estáticos (sem pulse), ainda visíveis. Vale também para o dashboard.

## Rodar os testes da feature

```bash
# Unit (componente compartilhado + cada loading.tsx)
bun run test:unit

# E2E determinístico do mecanismo (navegação atrasada em /books)
bun run test:e2e -- books-loading-skeleton
```

## Verificação final (antes do PR — Princípio XVI)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

Verificação manual de layout shift (SC-003): com o preview do `loading.tsx` ativo no Next DevTools, alternar entre loading e conteúdo real em `/books` e `/books/[id]` — a moldura (título, busca, botão) não deve se mover. A fidelidade da moldura é garantida por construção: `ListPageLoading` espelha classes/spacing de `books-client.tsx`.

## Arquivos-chave

| Arquivo | Papel |
|---------|-------|
| `src/components/layout/page-loading.tsx` | `ListPageLoading` + `LoadingBlock` + `LoadingStatus` |
| `src/components/ui/skeleton.tsx` | Primitivo com `motion-reduce:animate-none` |
| `src/app/(authenticated)/*/loading.tsx` | 6 estados de carregamento por rota |
| `__tests__/unit/components/layout/page-loading.spec.tsx` | Contrato do componente compartilhado |
| `__tests__/unit/app/route-loading-states.spec.tsx` | Contrato por rota |
| `__tests__/e2e/books-loading-skeleton.spec.ts` | Mecanismo fim-a-fim |
