# Research: Observabilidade em Produção (Day-Zero)

**Feature**: [029-production-observability](./spec.md) | **Plan**: [plan.md](./plan.md)

Decisões pesquisadas durante o `/speckit-plan`. Cada uma tem **Decisão**, **Rationale**, **Alternativas consideradas**. Numeração `Dn` é referenciada do `plan.md` e dos demais artefatos.

---

## D1. Library de logger estruturado

**Decisão**: Reusar e estender o `serverLogger` existente em `src/lib/logger/server-logger.ts`. **Não adicionar `pino`**.

**Rationale**: O `serverLogger` já emite JSON via `console.{info,warn,error}` — exatamente o que o Vercel captura como structured log no painel. Suas três funções (`info/warn/error`) já cobrem 100% do uso atual. Adicionar `pino` traria peso adicional (~200kb), exigiria configuração de transport para dev (pretty-print) e duplicaria capability que já existe. A extensão necessária para FR-001 é cirúrgica: ler `requestContext` e injetar `request_id` + `user_id` automaticamente no payload.

**Alternativas consideradas**:
- `pino` + `pino-pretty` — capability vs custo desfavorável (peso, complexidade de transport, sem ganho funcional sobre o existente).
- Logger nativo do Next.js (`console.*`) sem envelope JSON — perde estrutura no Vercel; difícil filtrar.
- Lib custom com transports plugáveis (winston, bunyan) — over-engineering para a escala atual.

---

## D2. SDK de error tracking

**Decisão**: `@sentry/nextjs` versão `^8.x` com configuração canônica em três arquivos (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) e wrap do `next.config.ts` via `withSentryConfig` para upload de source maps no build.

**Rationale**: É a integração oficial mantida pelo Sentry para Next.js App Router, suporta os três runtimes (server/edge/client) com config separada, faz upload de source maps automaticamente no build de produção via webhook do Vercel, e é o caminho mais barato para satisfazer FR-017–FR-019. Free tier (5k erros/mês) é suficiente para o uso atual.

**Alternativas consideradas**:
- Better Stack (Logtail + Sentry-like) — plataforma unificada mas menos madura no ecossistema Next.js; ganho marginal para perda de comunidade/docs.
- Axiom — bom para logs, fraco para erros agrupados; complementar ao Sentry, não substituto.
- Apenas `serverLogger` + Vercel UI — não agrupa erros por assinatura; investigação fica manual em logs. Viola espírito de FR-017.
- Auto-hospedar GlitchTip — over-ops para dev solo.

---

## D3. FK do `audit_log.user_id` ao `user`

**Decisão**: **Sem FK**. Coluna `user_id uuid NULL` denormalizada.

**Rationale**: Audit log existe para sobreviver ao ciclo de vida do dado de origem. Se a constituição proíbe `ON DELETE SET NULL` (artigo Princípio XI) e exige `RESTRICT`, FK ao user impediria hard-delete por compliance LGPD futura. Audit log é a **única exceção válida** dessa regra no projeto, pelo seu papel histórico. Documentar a exceção explicitamente.

**Alternativas consideradas**:
- FK `ON DELETE RESTRICT` — bloqueia hard-delete de usuário com histórico de audit; impede LGPD.
- FK `ON DELETE SET NULL` — viola Princípio XI da constituição.
- FK `ON DELETE CASCADE` — apaga histórico junto com o usuário; contraria o propósito do audit.
- Snapshot table `audit_user_meta` — over-engineering; precisa pra uso interno mínimo.

---

## D4. Tipo da coluna `audit_log.entity_id`

**Decisão**: `text NOT NULL` (com possibilidade de `NULL` apenas para eventos auth sem entidade alvo).

**Rationale**: Hoje todas as entidades usam `uuid`. Amanhã o projeto pode introduzir entidades com `text` (slug), `bigint` (sequencial), ou ids compostos. `text` aceita qualquer representação textual sem migration. Custo de espaço é desprezível para 200k linhas/mês (≈ 4 bytes a mais por linha vs `uuid` binário). Performance de índice composto não é afetada — índice em `(entity_type, entity_id)` continua selecionando rapidamente.

**Alternativas consideradas**:
- `uuid` — força conversão e quebra para entidades futuras com outros formatos.
- `jsonb` — over-engineering para uma referência simples.
- Múltiplas colunas tipadas (`entity_id_uuid`, `entity_id_text`, …) — complica todo SELECT.

---

## D5. Vercel Cron — agendamento e proteção

**Decisão**: Vercel Cron em `vercel.json` com schedule `0 3 * * *` (UTC; ≈ 00:00 BRT) apontando para `/api/cron/purge-audit-log`. Endpoint protegido por header `Authorization: Bearer <CRON_SECRET>` validado em código — `CRON_SECRET` é env var de produção rotacionável.

**Rationale**: Vercel Cron é a forma nativa e gratuita de agendar jobs no Hobby (1 cron/dia) e Pro (sem limite). Header de autorização é a forma documentada de proteger endpoints de cron contra invocação externa — não dá pra confiar apenas em obscuridade do path. O horário 03:00 UTC é "vale de tráfego" no Brasil (00:00 BRT, dormindo) e evita conflito com qualquer carga de trabalho diurna. Schedule diária é mais que suficiente — perder um dia por falha não afeta correctness, apenas estende temporariamente a janela de retenção.

**Alternativas consideradas**:
- Vercel Cron sem proteção explícita — qualquer um descobrir a URL pode acionar; risco real porque purge é destrutivo.
- `pg_cron` no Postgres — exige extensão habilitada no provider; nem Supabase nem Neon expõem `pg_cron` no free tier de forma confiável.
- GitHub Actions agendado — adiciona dependência cross-platform; mais peças móveis.
- Job em background no servidor Next — Vercel serverless mata processos após response; não dá pra rodar background steady.

---

## D6. Versionamento do `/api/health`

**Decisão**: Manter fora de `/api/v1/**`. Path final: `/api/health` (já existente).

**Rationale**: Health check é contrato de infraestrutura consumido por monitor externo (UptimeRobot/BetterStack), não por código de domínio. Versionar exigiria coordenação síncrona com o monitor a cada bump (mudar URL no painel externo), o que é fricção real sem benefício. Princípio X da constituição fala em `/api/v1/` para recursos de domínio — health não é recurso de domínio. `/api/cron/*` adota a mesma convenção pelo mesmo motivo.

**Alternativas consideradas**:
- Mover para `/api/v1/health` — burocracia operacional pura.
- `/health` sem prefixo `/api` — viola convenção do projeto (todas as rotas server vão sob `/api`).

---

## D7. Upload de source maps

**Decisão**: Plugin `@sentry/nextjs` faz upload automaticamente no build de produção (via `withSentryConfig`), usando token Sentry passado por env var (`SENTRY_AUTH_TOKEN`). Source maps NÃO são servidos publicamente — Sentry mantém cópia privada.

**Rationale**: Source maps no browser quebram um princípio de produção (expõem código não-minificado a anyone). A integração oficial faz upload privado para o Sentry no build e apaga após o upload (configurável). Resultado: stacks legíveis na UI do Sentry, código minificado no browser.

**Alternativas consideradas**:
- Servir `.map` ao público — vazamento de IP de código.
- Não fazer upload — stack traces minificados são quase inúteis para investigação.
- Upload manual via CLI no CI — fragiliza pipeline; integração oficial cobre.

---

## D8. Onde mora o catálogo de `action` values

**Decisão**: Constante única `AUDIT_ACTIONS` em `src/lib/audit/audit-actions.ts` exportando objeto literal `as const` + tipo `AuditAction` derivado.

**Rationale**: TS detecta uso de string fora do catálogo em compile-time (Princípio XII, sem `any`). Adicionar novo valor é uma linha; remover é audit-trail no git diff. Domain services importam o valor específico (`AUDIT_ACTIONS.CHAPTER_UPDATE`) em vez de string mágica. Testes "catalog frozen" garantem que valores não sumam silenciosamente.

**Alternativas consideradas**:
- Enum TS — gera código JS extra desnecessário; menos ergonômico para iteração.
- Schema Zod com `z.enum([...])` — duplica fonte da verdade; o constante já é o catálogo.
- Tabela `audit_action` no DB — over-engineering; nada muda em runtime.

---

## D9. Como garantir que toda mutação chama o audit

**Decisão**: Cada teste de integration de mutação assert que a linha `audit_log` correspondente existe. Adicionar uma mutação sem audit = teste falha. **Não há linter custom** — confiança vem do TDD enforcement.

**Rationale**: Verificação estática (greps, AST-walkers) é frágil — muda a forma como o service expressa a mutação e o linter quebra. Verificação dinâmica via teste de integração é o que importa para correctness: se o audit não foi gravado, o teste falha onde dói (na verificação do efeito). Domain service test passa a contar com `expect(auditLog).toHaveLength(1)` no final.

**Alternativas consideradas**:
- AST linter custom — falsos positivos/negativos; manutenção contínua.
- Decorator/AOP — não-idiomatic em TypeScript; complica leitura.
- Eslint rule custom — mesmo problema do AST linter.

---

## D10. Skills consultadas (Princípio XV)

**Decisão**: `/deployment-patterns` (⭐ principal), `/api-design`, `/backend-patterns`, `/postgres-patterns`, `/dashboard-builder`. Aplicações concretas estão na tabela "Skills Consultadas" do [plan.md](./plan.md#skills-consultadas).

**Rationale**: O usuário priorizou `/deployment-patterns` porque é o primeiro deploy em produção. As outras 4 cobrem as 4 dimensões técnicas (REST, backend, DB, dashboards) que a feature toca. `/tdd` é coberto via Princípio V já internalizado e não foi consultado separadamente nesta passagem.

**Alternativas consideradas**: `/frontend-patterns` — descartado, feature não toca frontend. `/security-review` — pode ser consultado em `/speckit-tasks` se o CRON_SECRET ou SENTRY_DSN levantarem questão de threat model adicional.

---

## D11. Semântica transacional do audit log

**Decisão**: Mutações de domínio: `auditService.recordWithin(tx, event)` dentro da mesma transação. Eventos de auth: `auditService.record(event)` (best-effort, sem TX) com erro logado via `serverLogger.warn` mas não propagado.

**Rationale**: Princípio XI já exige transação para mutação multi-tabela. Audit + entidade alterada são "multi-tabela". Garantia: zero audit órfão (commit da mutação implica commit do audit) e zero mutação sem audit (rollback do audit implica rollback da mutação). Auth não tem essa garantia porque better-auth não expõe TX no callback — embrulhar better-auth seria fricção altíssima; melhor aceitar a janela best-effort e documentar.

**Alternativas consideradas**:
- Outbox pattern + worker — over-engineering pro volume atual.
- After-commit hook — janela de race entre commit e audit write.
- Audit em conexão separada — sem garantia de atomicidade.

---

## D12. Sampling do Sentry para ficar no free tier

**Decisão**: `tracesSampleRate: 0` (sem APM), `sampleRate: 1.0` (100% dos erros), filtrar `DomainError` antes do envio (não vai para o Sentry — é erro de domínio esperado), filtrar erros de cliente vindos de bots/scanners. Em prod, `enabled` = true; em dev, `enabled: false` (não envia, só loga local).

**Rationale**: Free tier dá 5k erros/mês. Numa app de 10 usuários, 5k erros não-domínio é muito além do esperado. Não amostrar = capturar todo erro real. APM (`tracesSampleRate`) iria estourar quota com 50–200k requests/mês — descartado.

**Alternativas consideradas**:
- `tracesSampleRate: 0.1` — 10% das requests viram trace; ainda estoura free tier; baixo valor incremental.
- `sampleRate: 0.5` — pode mascarar bug raro que ocorre 1/dia.
- Filtrar tudo > 4xx — perde sinal de bug real.

---

## D13. Isolamento de audit em testes

**Decisão**: Audit log segue o mesmo padrão de isolamento das demais tabelas:
- **Integration**: `BEGIN/ROLLBACK` (Princípio V) — audit some junto.
- **E2E**: `TRUNCATE` seletivo no `beforeEach` inclui `audit_log` (não na allowlist de tabelas preservadas).
- **Unit**: usa fake `InMemoryAuditLogRepository` injetado no service via construtor.

**Rationale**: Padrão é coerente com tudo no projeto. Audit não é tabela "estável" como `user`/`account`/`session` — pelo contrário, queremos que cada teste comece com tabela vazia.

**Alternativas consideradas**: tratar como tabela estável — complica setup sem ganho.

---

## D14. Proteção do endpoint de cron contra abuso interno

**Decisão**: `Authorization: Bearer <CRON_SECRET>` validado em código com comparação constant-time (`crypto.timingSafeEqual`). Sem rate-limit adicional. `CRON_SECRET` é gerado uma vez no provisionamento (≥ 32 bytes urandom-safe) e armazenado em Vercel Env Vars com escopo "Production".

**Rationale**: O Vercel Cron envia o header automaticamente; ataque externo só passa se conhecer o secret. Constant-time compare evita timing attacks. Rate-limit não é necessário — endpoint é idempotente e raro (1×/dia).

**Alternativas consideradas**:
- Sem header secret — confia em obscuridade do path; insuficiente para destrutivo.
- Vercel Auth via `x-vercel-signature` — não é exposto pelo Cron interno.
- IP allowlist do Vercel — Vercel não publica IP range estável.

---

## D15. Estratégia de índices na `audit_log`

**Decisão**: 4 índices:

1. `(user_id, created_at DESC) WHERE user_id IS NOT NULL` — partial B-tree para consulta "ações do usuário X".
2. `(entity_type, entity_id, created_at DESC)` — B-tree composto para "ações sobre `chapter:abc`".
3. `(request_id)` — B-tree simples para correlação ponto-a-ponto (FR-001).
4. `(created_at) USING brin` — BRIN para purge daily (range scan em coluna time-series).

**Rationale**:
- Composto cobre eq + range (postgres-patterns: "equality first, then range"). `DESC` casa com `ORDER BY created_at DESC` típico de "histórico recente primeiro".
- Partial evita inflar índice com eventos auth sem user resolvido (login.failed pode ter `user_id IS NULL`).
- `request_id` é cardinalidade muito alta (1 valor por request); B-tree é correto, sem composto.
- BRIN no `created_at` é 1% do tamanho de B-tree para o mesmo padrão (range scan sequencial em coluna monótona). Postgres-patterns recomenda explicitamente para time-series.

**Alternativas consideradas**:
- Apenas (3) — perde performance de consultas por usuário/entidade.
- B-tree também em `created_at` puro — desperdiça espaço; coberto por (1) e (2) com prefixo.
- GIN em `entity_type` — overkill; cardinalidade baixa, B-tree composto basta.
