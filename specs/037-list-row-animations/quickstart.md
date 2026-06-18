# Quickstart: List Row Enter/Exit Animations (Fase A)

**Feature**: 037-list-row-animations · **Date**: 2026-06-18

Como validar a feature manualmente e via testes. Pré-requisito: app rodando localmente (`bun run dev`) autenticado.

## Validação manual

### Entrada (US1)

1. **Narradores** (`/narrators`): clicar em adicionar, preencher e confirmar. → A nova linha **entra** com fade + slide curto e fica na posição final.
2. Repetir em **Editores** (`/editors`) e **Estúdios** (`/studios`).
3. **Capítulos**: abrir um livro (`/books/[id]`), usar "Adicionar capítulo". → A nova linha entra animada na posição escolhida.
4. Recarregar/navegar para a lista: as linhas existentes **não** animam (só novas entram).

### Saída (US2)

5. Remover um narrador/editor/estúdio. → A linha **sai** animada (fade + slide) e só então some.
6. Em capítulos: remover um capítulo individual → saída animada.
7. Em capítulos: selecionar vários e usar bulk-delete → todas as linhas selecionadas saem animadas.
8. Forçar erro de remoção (ex.: offline) → a linha volta (rollback), sem ficar presa em estado animado.

### Reduced-motion + tema (US3)

9. Ativar "reduzir movimento" no SO (ou DevTools → Rendering → Emulate `prefers-reduced-motion`). Criar/remover → mudanças **instantâneas**, sem animação.
10. Alternar tema claro/escuro e repetir criação/remoção → animação correta, sem flash de cor.

## Validação automatizada

```bash
# Unit — hook de presença e linhas
bun run test:unit

# E2E — fluxos de criação/remoção nas 4 listas + reduced-motion
bun run test:e2e

# Verificação final (antes do PR)
bun run lint
bun run build
```

### O que os testes asseguram

- **Unit (`use-row-presence`)**: sem entrada na carga inicial; id novo entra e limpa no `animationend`; remoção retém e só sai no `animationend`; reduced-motion → entrada no-op e saída imediata.
- **Unit (linhas)**: cada `<entity>-row` aplica `animate-in`/`animate-out` e `data-row-state` corretos por estado.
- **E2E**: linha aparece ao criar e some ao remover (incl. bulk-delete de capítulos); com `emulateMedia({ reducedMotion: 'reduce' })`, a mudança é instantânea.

## Critérios de aceite mapeados

| Success Criteria | Como verificar |
|------------------|----------------|
| SC-001/002 | Passos 1–7 (entrada/saída visíveis) |
| SC-003 | Passo 9 (reduced-motion instantâneo) |
| SC-004 | Transições ≤ 300 ms (`duration-200`) |
| SC-005 | Passo 10 (tema claro/escuro) |
| SC-006 | Item realmente criado/removido; contagens atualizam |
| SC-007 | Transições suaves (apenas opacity/transform) |
