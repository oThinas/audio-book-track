# Research: Transaction Rollback para Testes de Integração

**Date**: 2026-04-01  
**Feature**: 003-test-transaction-rollback

## R1: Transaction Rollback com Drizzle ORM + node-postgres

**Decision**: Usar raw `pg.PoolClient` para controlar a transação, e criar uma instância Drizzle por teste a partir desse client.

**Rationale**: Drizzle ORM aceita tanto `Pool` quanto `PoolClient` como argumento. Ao passar um `PoolClient` com uma transação aberta (`BEGIN`), todas as queries do Drizzle rodam dentro dessa transação. No `afterEach`, basta chamar `ROLLBACK` e devolver o client ao pool. Isso é mais simples e confiável do que usar `db.transaction()` do Drizzle, que faz commit automático no final.

**Alternatives considered**:
- `db.transaction()` do Drizzle: Faz commit automático — não permite rollback externo.
- Savepoints: Necessários apenas se o código sob teste faz `BEGIN`/`COMMIT` explícito. O Drizzle não faz, então savepoints são desnecessários.
- Truncate entre testes: Mais lento (DDL por tabela), menos elegante.

## R2: Vitest Setup File para Hooks Automáticos

**Decision**: Usar `setupFiles` no `vitest.config.ts` com um setup file específico para integration tests, configurando `beforeEach`/`afterEach` globais.

**Rationale**: Vitest permite diferentes configs via `vitest.workspace` ou via `test.include` patterns. Um setup file que executa automaticamente para testes em `__tests__/integration/` garante que todo teste herda o comportamento sem import manual. O setup file registra `beforeEach` (BEGIN + criar Drizzle) e `afterEach` (ROLLBACK + release client).

**Alternatives considered**:
- Import manual em cada arquivo: Viola FR-003 (mecanismo automático).
- `globalSetup`: Roda uma vez, não por teste — não serve para transaction-per-test.
- Vitest fixtures (`test.extend`): Elegante mas requer que cada teste use a fixture explicitamente — mais boilerplate.

**Decision refinement**: Usar Vitest project configuration (`vitest.config.ts` com `test.projects` ou workspace) para separar unit/integration/e2e, cada um com seu próprio setup file. Isso garante que o setup de transaction só roda para integration tests (FR-007).

## R3: Migração de Testes HTTP para Acesso Direto

**Decision**: Reescrever testes de integração para usar services/repositories diretamente com a instância Drizzle transacional, em vez de HTTP requests.

**Rationale**: Os testes atuais fazem HTTP requests para `localhost:3000`, o que exige o servidor rodando e usa uma conexão de banco separada (fora da transação do teste). Migrando para acesso direto:
- O teste controla a transação
- Não precisa do servidor rodando
- Mais rápido (sem overhead HTTP)
- Testa a lógica real (service layer), não a camada HTTP

**Alternatives considered**:
- Injetar transação no servidor: Complexo, frágil, requer refactoring do app.
- Manter HTTP tests separados: Viola a decisão da clarificação (opção B).

## R4: Test Factories

**Decision**: Criar factory functions simples em `__tests__/helpers/factories.ts` que recebem a instância Drizzle transacional e criam entidades.

**Rationale**: Factories simples (funções puras) são suficientes — não precisa de library como `fishery` ou `factory-girl` para o volume atual de entidades (user, session, account). Cada factory recebe o `db` transacional e retorna a entidade criada.

**Alternatives considered**:
- Library de factories (fishery, factory.ts): Overhead desnecessário para 3-4 entidades.
- Fixtures JSON: Não permitem geração dinâmica de dados únicos.

## R5: CI/CD — Remoção do Seed Step

**Decision**: Remover o step `bun run db:seed` do workflow de CI. Migrations continuam necessárias (criam as tabelas). Cada teste cria seus próprios dados via factories.

**Rationale**: Com transaction rollback, o seed seria revertido junto com o primeiro teste. Cada teste deve ser auto-contido.

**Alternatives considered**:
- Seed antes dos testes, fora de transação: Criaria dados "globais" que persistem entre testes — viola o princípio de isolamento.