# Research: Test Review & E2E Login

## R1: Playwright com Next.js

**Decision**: `@playwright/test` com `webServer` config.
**Rationale**: Playwright inicia Next.js automaticamente via `webServer`,
aguarda servidor estar pronto, e roda testes em browser real.
**Alternatives**: Cypress (não é o padrão do projeto), Vitest E2E (viola
regra de browser real).

## R2: Configuração Mínima

**Decision**: Chromium-only, headless, reporter HTML, traces on-first-retry.
**Rationale**: Projeto pequeno, um único browser é suficiente. Reporter HTML
facilita debug local. Traces economizam tempo ao investigar falhas.
**Alternatives**: Multi-browser (desnecessário para app interno).

## R3: Seed Data

**Decision**: Usar `bun run db:seed` antes de E2E (idempotente).
**Rationale**: Seed script já verifica existência do user antes de criar.
Simples e confiável.
**Alternatives**: Fixtures por teste (overhead desnecessário para login).

## R4: Seletores

**Decision**: Seletores semânticos (label, role) em vez de test-ids.
**Rationale**: Mais resilientes a mudanças de implementação, alinhados
com acessibilidade.
**Alternatives**: data-testid (funciona, mas acopla testes ao HTML).

## R5: Vitest E2E Removal

**Decision**: Remover projeto `e2e` do vitest.config.ts.
**Rationale**: E2E migra para Playwright. Manter no Vitest criaria
confusão e violaria classificação.