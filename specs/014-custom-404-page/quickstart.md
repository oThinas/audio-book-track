# Quickstart: Pagina 404 Personalizada

## Visao geral

Pagina 404 customizada com mensagens humoristicas de audiobooks/narracao. Server Component puro, sem dependencias adicionais.

## Arquivos a criar

1. `src/lib/constants/not-found-messages.ts` — array de 7 frases tematicas
2. `src/app/not-found.tsx` — Server Component da pagina 404

## Arquivos de teste

1. `__tests__/unit/constants/not-found-messages.test.ts` — validacoes do array
2. `__tests__/e2e/not-found.spec.ts` — pagina renderiza no browser

## Como testar manualmente

```bash
bun run dev
# Acessar http://localhost:1197/rota-inexistente
# Verificar: mensagem humoristica, botao "Voltar ao inicio", dark mode toggle
```

## Verificacao de qualidade

```bash
bun run lint
bun run test:unit
bun run test:e2e
bun run build
```
