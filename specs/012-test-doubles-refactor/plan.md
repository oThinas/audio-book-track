# Implementation Plan: Test Doubles Refactor

**Branch**: `012-test-doubles-refactor` | **Date**: 2026-04-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-test-doubles-refactor/spec.md`

## Summary

Refatorar testes unitários para substituir `vi.mock()` de módulos internos por test doubles manuais (fakes injetáveis via `vi.fn()`). Escopo real: 2 arquivos de teste + 2 módulos de produção correspondentes. Módulos externos e de infraestrutura permanecem com `vi.mock()` (allowlist). Documentar convenção de test doubles no CLAUDE.md.

## Technical Context

**Language/Version**: TypeScript 5.9.3 (Bun runtime)
**Primary Dependencies**: Vitest (test runner), Next.js 16.2.1 (App Router)
**Storage**: PostgreSQL (não afetado — apenas testes de unidade no escopo)
**Testing**: Vitest (`bun run test:unit`)
**Target Platform**: Node.js / Bun (testes locais)
**Project Type**: Web application (Next.js)
**Performance Goals**: Testes unitários < 50ms cada (existente)
**Constraints**: Nenhuma mudança de comportamento em produção; cobertura >= atual
**Scale/Scope**: 2 arquivos de teste refatorados, 2 módulos de produção ajustados, 1 convenção documentada

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Justificativa |
|-----------|--------|---------------|
| I. Capítulo como Unidade | N/A | Refatoração de testes — não afeta domínio |
| II. Precisão Financeira | N/A | Nenhum cálculo financeiro alterado |
| III. Ciclo de Vida do Capítulo | N/A | Nenhuma transição de status alterada |
| IV. Simplicidade (YAGNI) | PASS | Fakes usam `vi.fn()` (já existente no codebase) — sem abstrações novas |
| V. TDD | PASS | Testes continuam escritos e passando; regra de ouro atualizada para incluir fakes |
| VI. Arquitetura Limpa | PASS | Refatoração alinha com DI via construtor/parâmetro — melhora aderência ao princípio |
| VII. Frontend | N/A | Nenhum componente UI alterado |
| VIII. Performance | N/A | Sem impacto em runtime de produção |
| IX. Design Tokens | N/A | Sem mudanças visuais |
| X. API REST | N/A | Sem mudanças de endpoints |
| XI. PostgreSQL | N/A | Sem mudanças de schema/queries |
| XII. Anti-Padrões | PASS | Nenhum anti-padrão introduzido |
| XIII. KPIs | N/A | Sem mudanças em métricas |
| XIV. PDF | N/A | Sem mudanças no viewer |
| XV. Ferramentas | PASS | Usando skills mandatórias (speckit, tdd, code-review) |
| XVI. Qualidade | PASS | `bun run lint`, `bun run test:unit`, `bun run build` verificados por fase |

**Nota sobre Princípio V**: A constituição diz "se o teste usa `vi.mock()` para isolar a unidade → unit test". Esta é uma heurística descritiva, não mandatória. Após a refatoração, testes continuam isolando a unidade — via fakes injetados em vez de interceptação de módulos. O critério de classificação permanece válido.

**Gate result**: PASS — nenhuma violação detectada.

## Project Structure

### Documentation (this feature)

```text
specs/012-test-doubles-refactor/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Análise de padrões existentes e decisões
├── data-model.md        # Interfaces e tipos relevantes (sem novos modelos)
├── quickstart.md        # Guia rápido de implementação
└── tasks.md             # Gerado por /speckit-tasks (próxima fase)
```

### Source Code (repository root)

```text
# Arquivos de PRODUÇÃO a modificar
src/
├── app/api/health/route.ts          # Extrair lógica testável em função com params injetáveis
└── lib/db/
    └── instrumentation.ts           # Extrair lógica testável em função com params injetáveis (path a confirmar via T012 — pode ser src/instrumentation.ts)

# Arquivos de TESTE a modificar
__tests__/
├── unit/
│   ├── api/health.test.ts           # Remover vi.mock() de internos, injetar fakes
│   └── db/instrumentation.test.ts   # Remover vi.mock() de internos, injetar fakes
└── repositories/
    └── (sem novos fakes necessários)

# Arquivo de DOCUMENTAÇÃO a modificar
CLAUDE.md                            # Adicionar convenção de test doubles
```

**Structure Decision**: Nenhuma nova pasta ou estrutura criada. A refatoração opera dentro da estrutura existente, consistente com o padrão já estabelecido em `health-check.test.ts` e `user-preference-service.test.ts`.

## Fases de Implementação

### Fase 1: Refatorar módulo de produção e teste — health API route

**Objetivo**: Eliminar `vi.mock()` de `health.test.ts` para módulos internos `@/lib/db/ping` e `@/lib/db/health-check`.

**Abordagem**:
1. Ler o módulo de produção testado (route handler de health) para entender como importa `createDatabasePing` e `checkDatabaseConnection`.
2. Extrair a lógica do route handler em uma função que aceita as dependências como parâmetro (ex: `createHealthHandler(deps: { createPing, checkConnection })`).
3. O route handler original chama a função extraída com as dependências concretas — comportamento de produção inalterado.
4. Refatorar `health.test.ts` para chamar a função extraída com fakes via `vi.fn()`.
5. Verificar: `bun run test:unit` e `bun run lint`.

**Padrão de referência**: `health-check.test.ts` — já usa `vi.fn()` para `PingFn` injetado via parâmetro.

### Fase 2: Refatorar módulo de produção e teste — instrumentation

**Objetivo**: Eliminar `vi.mock()` de `instrumentation.test.ts` para módulos internos.

**Abordagem**:
1. Ler o módulo de instrumentação para entender como importa `createDatabasePing` e `checkDatabaseHealth`.
2. Extrair a lógica em função com parâmetros injetáveis, seguindo o mesmo padrão da Fase 1.
3. Refatorar `instrumentation.test.ts` para usar fakes injetados.
4. Verificar: `bun run test:unit` e `bun run lint`.

### Fase 3: Revisar setup global e documentar convenção

**Objetivo**: Confirmar que o setup global está correto e documentar a convenção de test doubles.

**Abordagem**:
1. Verificar que `__tests__/unit/setup.ts` contém apenas mocks da allowlist (`@/lib/db`, `@/lib/env`).
2. Adicionar seção no CLAUDE.md documentando a convenção de test doubles:
   - Quando usar fakes manuais (módulos internos)
   - Quando `vi.mock()` é aceitável (allowlist)
   - `vi.fn()` é livre para criar fakes tipados
   - Referência aos modelos existentes no codebase
3. Verificar: `bun run lint` e `bun run build`.

### Fase 4: Verificação final

**Objetivo**: Garantir que toda a suíte de testes passa e a cobertura está mantida.

**Abordagem**:
1. `bun run test:unit` — todos os testes unitários passam.
2. `bun run test:integration` — testes de integração não foram afetados.
3. `bun run lint` — sem erros ou warnings.
4. `bun run build` — build de produção compila.
5. Verificar com grep que nenhum `vi.mock()` restante referencia módulo interno fora da allowlist.
6. Confirmar que cobertura >= nível pré-refatoração.

## Allowlist de `vi.mock()` Permitidos

| Módulo | Categoria | Razão |
|--------|-----------|-------|
| `next/headers` | Framework externo | Next.js internals não injetáveis |
| `next/navigation` | Framework externo | Next.js internals não injetáveis |
| `@axe-core/playwright` | Biblioteca externa | Dependency de teste E2E |
| `better-auth/cookies` | Biblioteca externa | Auth library não injetável |
| `@/lib/env` | Infraestrutura de ambiente | Singleton de variáveis de ambiente |
| `@/lib/db` | Infraestrutura de I/O | Singleton de conexão PostgreSQL |

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Módulo de produção tem assinatura que dificulta extração | Baixa | Médio | Examinar código antes de cada fase; usar parâmetros opcionais com defaults |
| Testes existentes quebram após refatoração | Média | Baixo | Rodar testes após cada mudança; manter vi.mock() como fallback temporário |
| Convenção não é seguida em features futuras | Baixa | Baixo | Documentar no CLAUDE.md; modelos de referência claros no codebase |

## Complexity Tracking

Nenhuma violação de constituição detectada — seção não aplicável.

## Post-Phase 1 Constitution Re-Check

| Princípio | Status |
|-----------|--------|
| IV. Simplicidade | PASS — funções extraídas com parâmetros opcionais, sem classes ou abstrações novas |
| V. TDD | PASS — testes refatorados mantêm mesmos cenários e asserts |
| VI. Arquitetura Limpa | PASS — lógica extraída segue DI; route handlers permanecem finos |
| XII. Anti-Padrões | PASS — nenhum anti-padrão introduzido |
| XVI. Qualidade | PASS — lint, testes e build verificados por fase |