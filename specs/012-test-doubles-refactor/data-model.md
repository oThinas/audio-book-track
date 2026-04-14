# Data Model: Test Doubles Refactor

**Branch**: `012-test-doubles-refactor` | **Date**: 2026-04-14

## Resumo

Esta feature é uma refatoração de testes — não introduz novas entidades de domínio, tabelas de banco de dados ou modelos de dados. O "modelo" aqui são os tipos e interfaces existentes que os test doubles devem implementar.

## Interfaces Existentes Relevantes

### `UserPreferenceRepository` (domínio)

```
Localização: src/lib/domain/user-preference-repository.ts
Fake existente: __tests__/repositories/in-memory-user-preference-repository.ts
Status: Completo — já possui fake in-memory ✓
```

### `PingFn` (tipo de função)

```
Localização: src/lib/db/ping.ts (e re-exportado em health-check.ts)
Tipo: () => Promise<void>
Fake: vi.fn().mockResolvedValue(undefined) — já usado em health-check.test.ts
Status: Não precisa de classe fake — vi.fn() é suficiente por ser single-method ✓
```

### `DatabaseExecutor` (interface interna de ping.ts)

```
Localização: src/lib/db/ping.ts
Tipo: { execute(query: unknown): Promise<unknown> }
Status: Usado internamente por createDatabasePing — irrelevante para os testes que precisam de refatoração
```

## Novos Test Doubles Necessários

Nenhum novo test double de repository ou classe fake é necessário. A refatoração:
1. Reutiliza `vi.fn()` para criar fakes de `PingFn` (padrão já existente)
2. Reutiliza `InMemoryUserPreferenceRepository` (já existente)
3. Extrai lógica de módulos de produção para funções com parâmetros injetáveis

## Impacto em Dados

- Nenhuma migração de banco de dados
- Nenhuma alteração de schema
- Nenhuma nova entidade