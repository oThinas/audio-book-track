# Research: Test Doubles Refactor

**Branch**: `012-test-doubles-refactor` | **Date**: 2026-04-14

## Decisão 1: Quais testes precisam de refatoração?

**Decision**: Apenas 2 arquivos de teste usam `vi.mock()` para módulos internos do projeto e precisam ser refatorados.

**Análise completa dos 13 arquivos de teste unitário:**

| Arquivo | `vi.mock()` para interno? | Ação |
|---------|---------------------------|------|
| `api/health.test.ts` | Sim — `@/lib/db/ping`, `@/lib/db/health-check` | **Refatorar** |
| `db/instrumentation.test.ts` | Sim — `@/lib/db/ping`, `@/lib/db/health-check` | **Refatorar** |
| `api/auth/clear-session.test.ts` | Não — `next/headers`, `next/navigation` (externos) | Manter |
| `use-sidebar.test.ts` | Não — `next/headers` (externo) | Manter |
| `proxy/proxy.test.ts` | Não — `better-auth/cookies` (externo) | Manter |
| `accessibility-helper.test.ts` | Não — `@axe-core/playwright` (externo) | Manter |
| `db/health-check.test.ts` | Não — já usa `vi.fn()` injetado como `PingFn` | Modelo a seguir |
| `user-preference-service.test.ts` | Não — já usa `InMemoryUserPreferenceRepository` | Modelo a seguir |
| `schemas/auth.test.ts` | Não — testa schemas Zod puros | Nenhuma ação |
| `config/rate-limit.test.ts` | Não — config assertions puras | Nenhuma ação |
| `config/signup-blocked.test.ts` | Não — config assertions puras | Nenhuma ação |
| `user-preference-domain.test.ts` | Não — testa entidade de domínio pura | Nenhuma ação |
| `setup.ts` | `@/lib/db`, `@/lib/env` — allowlist | Revisar escopo |

**Rationale**: A análise revela que a maioria dos testes já segue boas práticas. O escopo real da refatoração é pequeno: 2 arquivos de teste + 2 módulos de produção correspondentes.

**Alternatives considered**: Refatorar todos os mocks incluindo frameworks externos → rejeitado porque mocks de `next/headers`, `next/navigation`, etc. são a forma padrão de testar código que depende de framework internals.

## Decisão 2: Estratégia de refatoração para os módulos de produção

**Decision**: Extrair lógica testável dos módulos de API e instrumentation em funções que aceitam dependências como parâmetro.

**Análise dos módulos afetados:**

1. **`health.test.ts`** testa a API route `app/api/health/route.ts` que importa `createDatabasePing` e `checkDatabaseConnection` diretamente. A API route não aceita injeção de dependência porque Next.js route handlers são funções exportadas com assinatura fixa.

2. **`instrumentation.test.ts`** testa o módulo de instrumentação que também importa essas funções diretamente.

**Estratégia**: Ambos os módulos de produção devem ter sua lógica extraída em funções que aceitam `PingFn` (ou equivalente) como parâmetro. O módulo original chama a função com as dependências concretas. O teste chama a função com `vi.fn()` fakes.

**Precedente no codebase**: `src/lib/db/health-check.ts` já segue esse padrão — `checkDatabaseHealth(ping, options?)` aceita `PingFn` injetado. O teste `db/health-check.test.ts` já é o modelo ideal.

**Alternatives considered**: Criar classes de service para wrappear a lógica → rejeitado por YAGNI (Princípio IV). Funções com parâmetros opcionais são suficientes.

## Decisão 3: Formato da convenção de testes

**Decision**: Documentar a convenção como seção no CLAUDE.md do projeto, sob a constituição existente de classificação de testes.

**Rationale**: O CLAUDE.md já contém regras de classificação de testes (unit, integration, E2E). Adicionar a convenção de test doubles como extensão natural dessa seção garante que todo agente ou desenvolvedor leia as regras no mesmo lugar.

**Alternatives considered**: Arquivo separado `TESTING.md` → rejeitado porque fragmentaria as regras; adicionar na constituição → rejeitado porque a constituição é mais geral e a mudança seria MINOR semver.

## Decisão 4: Revisão do setup global

**Decision**: `__tests__/unit/setup.ts` permanece com `vi.mock("@/lib/db")` e `vi.mock("@/lib/env")` — ambos na allowlist de infraestrutura.

**Análise**: O setup.ts contém apenas 2 mocks globais, ambos para módulos de infraestrutura (conexão PostgreSQL e variáveis de ambiente). Estes são side-effects que nenhum teste unitário deve executar realmente. Manter no setup global é correto.

**Ação**: Nenhuma mudança necessária no setup.ts. Apenas documentar na convenção que estes são os mocks globais permitidos.