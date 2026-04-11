# Implementation Plan: Database Health Check

**Branch**: `010-db-health-check` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/010-db-health-check/spec.md`

## Summary

Adicionar verificação de saúde do banco de dados na inicialização da aplicação Next.js usando `instrumentation.ts`, com retry limitado (3 tentativas, intervalo de 2s) e fail fast se o PostgreSQL não estiver acessível. Complementar com endpoint HTTP `GET /api/health` para monitoramento contínuo por load balancers e orquestradores.

## Technical Context

**Language/Version**: TypeScript ^5.9.3  
**Primary Dependencies**: Next.js 16.2.1, pg ^8.20.0 (node-postgres Pool), Drizzle ORM ^0.45.2, Zod ^4.3.6  
**Storage**: PostgreSQL (via pg.Pool existente)  
**Testing**: Vitest ^4.1.2 (unit + integration), Playwright ^1.59.1 (E2E)  
**Target Platform**: Node.js server (Bun runtime)  
**Project Type**: Web application (Next.js App Router)  
**Performance Goals**: Verificação de inicialização < 2s no caminho feliz; endpoint < 3s  
**Constraints**: Timeout de 5s por tentativa; máximo 3 tentativas na inicialização  
**Scale/Scope**: 4 arquivos novos, 2 arquivos de teste novos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Princípio | Status | Notas |
|-----------|--------|-------|
| I. Capítulo como Unidade | N/A | Feature não toca entidades de domínio |
| II. Precisão Financeira | N/A | Sem cálculos financeiros |
| III. Ciclo de Vida | N/A | Sem transições de status |
| IV. YAGNI | PASS | Solução mínima: 1 função de health check + 1 endpoint. Sem abstrações desnecessárias (sem Repository/Service/Factory para SELECT 1) |
| V. TDD | PASS | Testes unitários e de integração planejados. Cobertura >= 80% |
| VI. Clean Architecture | PASS (com nota) | Health check é infraestrutura, não lógica de negócio. `SELECT 1` em `lib/db/health-check.ts` é acesso de infraestrutura, não acesso a dados de domínio. Ver R-002 em research.md |
| VII. Frontend | N/A | Sem alterações de frontend |
| VIII. Performance | PASS | < 2s no caminho feliz. Sem impacto no bundle |
| IX. Design Tokens | N/A | Sem alterações visuais |
| X. API REST | PASS | Endpoint segue padrão: `GET /api/health`, 200/503, JSON. Nota: sem versionamento `/v1/` pois é infraestrutura, não API de negócio |
| XI. PostgreSQL | PASS | Usa pool existente, sem SELECT *, sem novas tabelas |
| XII. Anti-Padrões | PASS (com nota) | Sem any, sem catch vazio, sem segredos hardcoded. **Exceção documentada**: `instrumentation.ts` usa `console.info`/`console.error` porque executa antes do servidor estar pronto — structured logger pode não estar inicializado neste ponto. Prefixo `[health-check]` garante rastreabilidade mínima. |
| XIII. KPIs | N/A | Sem alterações em métricas |
| XIV. PDF Viewer | N/A | Sem alterações |
| XV. Ferramentas | PASS | speckit workflow seguido, Context7 consultado para Next.js instrumentation |
| XVI. Qualidade | PASS | lint + test + build gates em cada fase |

**Gate result**: PASS — nenhuma violação identificada.

## Project Structure

### Documentation (this feature)

```text
specs/010-db-health-check/
├── plan.md              # Este arquivo
├── spec.md              # Especificação da feature
├── research.md          # Decisões técnicas e alternativas avaliadas
├── data-model.md        # Modelo de dados (N/A — sem alterações)
├── quickstart.md        # Guia rápido de verificação
├── contracts/
│   └── health-endpoint.md  # Contrato do endpoint GET /api/health
├── checklists/
│   └── requirements.md     # Checklist de qualidade da spec
└── tasks.md             # Tarefas de implementação (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── instrumentation.ts                 # NOVO — hook de startup do Next.js
├── lib/
│   └── db/
│       ├── index.ts                   # EXISTENTE — sem alteração
│       ├── health-check.ts            # NOVO — funções puras com PingFn (inversão de dependência)
│       └── ping.ts                    # NOVO — createDatabasePing(db) via Drizzle
└── app/
    └── api/
        └── health/
            └── route.ts               # NOVO — endpoint GET /api/health

__tests__/
├── unit/
│   └── db/
│       └── health-check.test.ts       # NOVO — testes unitários
└── integration/
    └── infra/
        └── health-check.test.ts       # NOVO — testes de integração
```

**Structure Decision**: Segue a estrutura existente do projeto. Novos arquivos colocados nos diretórios já estabelecidos (`lib/db/` para infraestrutura de banco, `app/api/` para endpoints, `__tests__/` para testes).

## Complexity Tracking

Nenhuma violação da constituição para justificar.

## Design Detalhado

### Componente 1: `src/lib/db/health-check.ts`

Função pura de infraestrutura que verifica conectividade com o banco. Usa inversão de dependência: recebe uma função `ping` em vez de depender diretamente do Pool ou Drizzle.

**Type exportado**:
- `PingFn = () => Promise<void>` — abstração para execução de query de conectividade

**Exportações**:
- `checkDatabaseHealth(ping: PingFn, options?)` — executa ping com retry e timeout
- `checkDatabaseConnection(ping: PingFn, timeoutMs?)` — tentativa única (usada pelo endpoint)

**Parâmetros de `options`**:
- `maxRetries`: número máximo de tentativas (padrão: 3)
- `retryIntervalMs`: intervalo entre tentativas em ms (padrão: 2000)
- `timeoutMs`: timeout por tentativa em ms (padrão: 5000)

**Comportamento**:
1. Chama `ping()` com timeout via `Promise.race` ou `AbortSignal.timeout`
2. Se sucesso: retorna `{ healthy: true }`
3. Se falha: aguarda `retryIntervalMs`, tenta novamente
4. Após esgotar tentativas: retorna `{ healthy: false, error: string }` com mensagem categorizada (conexão recusada, timeout, autenticação)

**Categorização de erros** (sem expor connection string):
- `ECONNREFUSED` → "Conexão recusada — verifique se o PostgreSQL está rodando"
- Timeout → "Timeout — o banco não respondeu dentro de Ns"
- Auth error (code `28P01`) → "Autenticação falhou — verifique credenciais"
- Outros → "Erro de conexão — verifique a configuração do banco"

**Inversão de dependência**: `health-check.ts` não importa `pg`, `drizzle-orm`, nem `lib/db`. O chamador (instrumentation.ts, route.ts) é responsável por criar a função `ping` concreta.

### Componente 2: `src/lib/db/ping.ts`

Função concreta de ping que conecta a abstração `PingFn` ao Drizzle.

**Exportação**:
- `createDatabasePing(db): PingFn` — retorna uma função que executa `db.execute(sql\`SELECT 1\`)` e descarta o resultado

**Motivação**: Isolar a criação da função `ping` concreta em um único local. Tanto `instrumentation.ts` quanto `route.ts` importam daqui em vez de duplicar a lógica de `db.execute()`.

### Componente 3: `src/instrumentation.ts`

Hook `register()` do Next.js que executa na inicialização.

**Comportamento**:
1. Importa `db` de `lib/db` e `createDatabasePing` de `lib/db/ping`
2. Cria `ping` via `createDatabasePing(db)`
3. Chama `checkDatabaseHealth(ping)` com parâmetros padrão
4. Se saudável: loga `[health-check] Database connection verified successfully`
5. Se não saudável: loga `[health-check] Database health check failed after N attempts: <mensagem>` e chama `process.exit(1)`

### Componente 4: `src/app/api/health/route.ts`

Route handler GET sem autenticação.

**Comportamento**:
1. Importa `db` de `lib/db` e `createDatabasePing` de `lib/db/ping`
2. Cria `ping` via `createDatabasePing(db)`
3. Chama `checkDatabaseConnection(ping, 5000)` (tentativa única)
4. Se saudável: retorna `200 { status: "healthy", checks: { database: "healthy" } }`
5. Se não saudável: retorna `503 { status: "unhealthy", checks: { database: "unhealthy" } }`
6. Header `Cache-Control: no-store` (resultado nunca cacheado)

### Testes

**Unit (`__tests__/unit/db/health-check.test.ts`)**:
- Testa `checkDatabaseHealth` com `PingFn` mockada (`vi.fn()`)
- Cenários: sucesso na 1a tentativa, sucesso na 3a tentativa, falha após 3 tentativas
- Verifica categorização de erros (ECONNREFUSED, timeout, auth)
- Verifica que connection string não aparece nas mensagens de erro
- Verifica número de tentativas e intervalos

**Integration (`__tests__/integration/infra/health-check.test.ts`)**:
- Testa `checkDatabaseConnection` com banco real
- Cenário: banco acessível → retorna healthy
- Usa o setup de integração existente (`__tests__/integration/setup.ts`)