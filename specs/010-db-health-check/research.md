# Research: Database Health Check

**Branch**: `010-db-health-check` | **Date**: 2026-04-10

## R-001: Mecanismo de execução na inicialização do Next.js

**Decision**: Usar `instrumentation.ts` com a função `register()` do Next.js.

**Rationale**: A função `register()` é chamada uma vez quando o servidor Next.js inicia e **deve completar antes de aceitar requisições** (confirmado na documentação oficial do Next.js 16.2). Pode ser `async`. Este é o mecanismo oficial e recomendado para tarefas de inicialização do servidor.

**Alternatives considered**:
- Custom server (`server.ts`): Requer abandonar o servidor embutido do Next.js. Complexidade desnecessária.
- Middleware (`middleware.ts`): Executa em cada requisição, não na inicialização. Não atende o requisito de fail-fast.
- Verificação lazy no primeiro request: Exatamente o anti-padrão que queremos eliminar — o usuário sofreria a falha.

## R-002: Localização da lógica de health check

**Decision**: Criar `src/lib/db/health-check.ts` como módulo de infraestrutura.

**Rationale**: O health check executa `SELECT 1` — é verificação de infraestrutura, não lógica de negócio. Não se enquadra no padrão Repository (que encapsula acesso a dados de domínio) nem no padrão Service (que orquestra lógica de negócio). Uma função pura de infraestrutura em `lib/db/` é a solução mais simples que atende o requisito (Princípio IV — YAGNI).

**Alternatives considered**:
- `HealthCheckRepository` + `HealthCheckService` + `HealthCheckFactory`: Over-engineering para uma única query de ping. Viola YAGNI.
- Inline no `instrumentation.ts`: Duplicaria lógica com o endpoint de health check. Viola DRY.

**Nota sobre anti-padrão "SQL direto fora de repositories"**: A constituição proíbe SQL direto fora de repositories para acesso a **dados de domínio**. O `SELECT 1` é uma verificação de conectividade de infraestrutura que não acessa nenhuma entidade do domínio (Estúdio, Livro, Capítulo). O pool de conexão (`pg.Pool`) é a dependência direta — não há ORM ou schema envolvido.

## R-003: Estratégia de retry na inicialização

**Decision**: Até 3 tentativas com intervalo de 2 segundos, timeout de 5 segundos por tentativa.

**Rationale**: Definido durante a fase de clarificação da spec. Em ambientes com containers (Docker Compose), é comum a aplicação iniciar antes do banco estar pronto. 3 tentativas × (5s timeout + 2s intervalo) = ~21s no pior caso, mas o cenário realista é ~6-8s (tentativas rápidas falhando por conexão recusada).

**Alternatives considered**:
- Tentativa única (fail fast puro): Quebraria em deploy com Docker Compose quando o banco demora para subir.
- Retry infinito com backoff: Nunca falharia — esconderia problemas de configuração.
- Retry configurável via env: Complexidade adicional sem requisito concreto (YAGNI). Pode ser adicionado no futuro se necessário.

## R-004: Endpoint de health check — design

**Decision**: `GET /api/health` sem autenticação, retornando JSON com status e checks individuais.

**Rationale**: Padrão da indústria para health checks. Balanceadores de carga (ALB, nginx, Traefik) e orquestradores (Docker, Kubernetes) esperam um endpoint HTTP simples. Sem autenticação para permitir uso por ferramentas de infraestrutura.

**Alternatives considered**:
- `/api/v1/health`: O versionamento `/v1/` é para APIs de negócio. O health check é infraestrutura e não muda com versões de API.
- `/healthz` (Kubernetes style): Válido, mas `/api/health` é mais consistente com a estrutura de rotas existente do projeto.
- TCP check apenas: Insuficiente — verifica que o processo está rodando mas não que o banco está acessível.

## R-005: Formato de resposta do endpoint

**Decision**: JSON minimalista com status geral e checks por componente.

**Rationale**: Permite que ferramentas de monitoramento parseiem a resposta programaticamente. Checks por componente (ex: `database`) facilitam diagnóstico quando novos serviços forem adicionados no futuro.

```json
// Sucesso (200)
{
  "status": "healthy",
  "checks": {
    "database": "healthy"
  }
}

// Falha (503)
{
  "status": "unhealthy",
  "checks": {
    "database": "unhealthy"
  }
}
```

**Alternatives considered**:
- Resposta com detalhes técnicos (latência, versão do banco): Viola FR-008 (não expor informações sensíveis).
- Resposta plain text: Menos útil para parsing automatizado.
- Envelope padrão da API (`{ data: ... }`): O health check é infraestrutura, não segue o envelope de API de negócio.