# Feature Specification: Observabilidade em Produção (Day-Zero)

**Feature Branch**: `029-production-observability`
**Created**: 2026-05-23
**Status**: Draft
**Input**: User description: "Adicionar observabilidade. Saber o tempo que a aplicação está online, o tanto de recurso da máquina está sendo usado, o que cada usuário está fazendo no sistema, quanto tempo o sistema está levando para executar cada operação. Isso garante que um bug em produção possa ser investigado."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Investigar request específica via `request_id` (Priority: P1)

Como dev solo do AudioBook Track, quando um usuário reportar um problema (ou eu suspeitar de algo estranho em produção), consigo partir de um único identificador — o `request_id` da requisição — e reconstruir em poucos minutos o que aconteceu: qual rota foi chamada, por qual usuário, em que duração, com que status, e — se foi uma mutação de domínio — qual ação de auditoria foi registrada.

**Why this priority**: É o caso de uso central que motivou a feature ("garantir que um bug em produção possa ser investigado"). Sem essa correlação ponta-a-ponta, todos os outros pedaços (audit log, logs estruturados, error tracking) viram silos isolados.

**Independent Test**: Reproduzir uma mutação qualquer em ambiente de homolog, capturar o `X-Request-Id` da resposta (já emitido pelo `withApiErrorHandler` desde a feature 023), e demonstrar que partindo só desse identificador eu encontro o log HTTP (Vercel UI), a entrada de audit (Postgres) e, se aplicável, o stack trace (ferramenta de erros).

**Acceptance Scenarios**:

1. **Given** uma mutação `PUT /api/v1/chapters/:id` bem-sucedida, **When** o operador olha a resposta, **Then** o header `X-Request-Id` está presente e o mesmo valor aparece (a) no log estruturado da Vercel, (b) na coluna `request_id` da entrada de audit, ambos correlacionáveis em < 5 minutos.
2. **Given** uma exceção lançada por um service em produção, **When** o erro é capturado pela ferramenta de error tracking, **Then** o evento contém o `request_id` correspondente, o `user_id` (quando autenticado), e a rota original, permitindo navegar de volta para o log HTTP e para a entrada de audit (quando a operação era uma mutação).
3. **Given** um usuário relata "o sistema deu erro quando salvei o capítulo", **When** o operador pergunta o horário aproximado e o usuário, **Then** consegue isolar o `request_id` específico em < 2 minutos via filtro nos logs HTTP e a partir dele acessa todos os artefatos correlacionados.

---

### User Story 2 - Saber se o app está fora do ar (Priority: P1)

Como dev solo, sou notificado em < 5 minutos quando o app fica indisponível por mais de 2 minutos, sem precisar ficar consultando manualmente. Esse é o único alerta proativo desta fase — todo o resto da observabilidade é consulta retrospectiva.

**Why this priority**: Único cenário que não pode esperar consulta sob demanda. Se o app cai e ninguém percebe, clientes descobrem por mim. Custo de implementação é baixo (endpoint + monitor externo gratuito).

**Independent Test**: Provisionar um monitor externo (UptimeRobot/BetterStack free) apontando para `/api/health`. Derrubar o app em homolog, esperar 2 minutos, verificar que a notificação chega no canal configurado (email/Slack). Implementável sozinho, sem depender das outras stories.

**Acceptance Scenarios**:

1. **Given** o app está saudável, **When** uma requisição `GET /api/health` é feita, **Then** a resposta retorna `200` em < 500ms com payload contendo: status geral, uptime em segundos, status do Postgres (alcançável + responde em tempo aceitável).
2. **Given** o Postgres está inalcançável, **When** uma requisição `GET /api/health` é feita, **Then** a resposta retorna `503` com payload detalhando que o DB está degradado (mas a aplicação Next.js continua respondendo).
3. **Given** o app está fora do ar há > 2 minutos, **When** o monitor externo realiza sua próxima verificação, **Then** o dev recebe notificação automática em < 5 minutos do início da indisponibilidade.

---

### User Story 3 - Identificar rotas lentas sem instrumentação manual (Priority: P2)

Como dev solo, quando suspeitar que algo está lento (cliente reclama, eu sinto que travou), consigo abrir os logs e ver imediatamente a duração de cada request por rota e por usuário, sem ter precisado adicionar instrumentação em cada controller ou service. Esse insight tira a "suspeita" e troca por dado.

**Why this priority**: Cobre o pedido original "quanto tempo o sistema está levando para executar cada operação". Implementável de uma vez via middleware único — escopo limitado e alto retorno.

**Independent Test**: Subir o app em homolog, gerar tráfego com `wrk` ou similar em rotas conhecidas (rápida e lenta), validar via Vercel UI que cada request gerou um log estruturado contendo `method`, `path`, `status`, `duration_ms`, `request_id`, `user_id` (quando autenticado).

**Acceptance Scenarios**:

1. **Given** uma request a qualquer rota em `/api/v1/**`, **When** ela termina (sucesso ou erro), **Then** um log estruturado JSON é emitido contendo no mínimo: timestamp ISO, `request_id`, `method`, `path`, `status`, `duration_ms`, `user_id` (ou `null` quando anônima).
2. **Given** 100 requests à mesma rota ao longo de uma hora, **When** o operador filtra os logs por `path`, **Then** consegue calcular percentil de duração (p50, p95) usando apenas as ferramentas nativas do provedor (filtros + export).
3. **Given** uma request supera 3 segundos de duração, **When** o log é emitido, **Then** ele inclui o flag `slow=true` para facilitar filtragem rápida de outliers sem cálculo de percentil.

---

### User Story 4 - Saber quem fez o quê (audit trail) (Priority: P2)

Como dev solo, quando precisar investigar uma mutação suspeita (financeira ou operacional), consigo consultar uma tabela de auditoria no banco e ver o histórico de ações de qualquer usuário ou em qualquer entidade, com janela retroativa de 90 dias. A consulta é feita via ferramenta de DB existente (Drizzle Studio, Supabase Studio, Outerbase, TablePlus etc.), sem UI customizada no app.

**Why this priority**: Cobre "o que cada usuário está fazendo no sistema". Crítico no domínio AudioBook Track porque uma mutação financeira indevida pode ser difícil de detectar sem audit (preço/hora, status `paid`, atribuições de narrador/editor).

**Independent Test**: Executar uma mutação representativa de cada agrupamento (criar Studio, atualizar Book, deletar Chapter, transição de status, login bem-sucedido, login falho) em homolog. Consultar a tabela de auditoria via Drizzle Studio e validar que cada ação gerou exatamente uma linha com os campos esperados.

**Acceptance Scenarios**:

1. **Given** um usuário autenticado executa qualquer mutação de domínio (Studio, Book, Chapter, Narrator, Editor — criar/atualizar/deletar/reativar/mudança de status), **When** a transação da mutação é commitada com sucesso, **Then** uma única linha é registrada na tabela de audit, **na mesma transação**, contendo: `user_id`, `action` (ex: `chapter.update`, `chapter.status.transitioned`), `entity_type`, `entity_id`, `request_id`, `created_at`.
2. **Given** a transação da mutação falha (rollback), **When** a operação é abortada, **Then** **nenhuma** linha de audit é gravada (consistência transacional garantida).
3. **Given** um evento de autenticação ocorre (login bem-sucedido, falha de login, logout, criação de conta), **When** o evento é processado, **Then** uma linha de audit é registrada com `user_id` (quando aplicável) e `action` correspondente (`auth.login.success`, `auth.login.failed`, `auth.logout`, `auth.signup`). Falha de auditoria nesses casos não bloqueia o evento de auth (best-effort).
4. **Given** a tabela de audit possui registros com `created_at` anterior a 90 dias, **When** o job de purga executar, **Then** todos esses registros são removidos e a operação é idempotente (rodar duas vezes no mesmo dia tem o mesmo efeito que uma).
5. **Given** uma consulta de investigação ("o que o usuário X fez na última semana"), **When** o operador filtra a tabela por `user_id` + `created_at`, **Then** retorna a lista ordenada cronologicamente em < 2 segundos para volumes esperados (até ~500 mil linhas/mês).

---

### User Story 5 - Erros capturados e agrupados automaticamente (Priority: P3)

Como dev solo, qualquer exceção não tratada (server-side em API routes ou client-side em componentes React) é capturada por uma ferramenta de error tracking externa, agrupada por assinatura, com stack trace de-minified via source map e contexto suficiente (rota, `user_id`, `request_id`) para investigação imediata. Eu recebo o erro automaticamente, sem precisar olhar log por log.

**Why this priority**: Os logs estruturados (story 3) já contêm erros, mas agrupar e priorizar por frequência exige ferramenta dedicada. Útil mas não bloqueante — o app pode subir sem isso e ainda investigar via Vercel UI. P3 reflete que é "ganho de produtividade", não "requisito absoluto".

**Independent Test**: Subir o app em homolog com Sentry (ou equivalente) configurado, lançar uma exceção controlada via endpoint de teste, validar que o erro aparece na UI da ferramenta em < 2 minutos com stack trace legível (não minificado), `request_id`, `user_id` quando aplicável.

**Acceptance Scenarios**:

1. **Given** uma exceção não capturada é lançada em uma rota `/api/v1/**`, **When** o `withApiErrorHandler` processa o erro, **Then** o evento é enviado à ferramenta externa contendo: mensagem, stack trace de-minified via source map, `request_id`, `user_id` (quando autenticado), método e rota.
2. **Given** uma exceção é lançada no client (Error Boundary do React, rejeição de Promise não tratada), **When** o handler global captura, **Then** o erro é enviado à ferramenta externa com URL atual, navegador, e quando autenticado também `user_id`.
3. **Given** o mesmo erro ocorre múltiplas vezes ao longo do dia, **When** o dev abre a UI da ferramenta, **Then** o erro está **agrupado** por assinatura (mensagem + stack), com contador e timeline, evitando spam de eventos individuais.

---

### User Story 6 - Métricas de infraestrutura visíveis (Priority: P3)

Como dev solo, quando precisar entender o "estado da máquina" — apesar de em Vercel Serverless não existir máquina fixa — consigo abrir as UIs nativas do provedor (Vercel + provedor do Postgres) e ver: duration por rota, invocations, error rate, cold starts, conexões ativas no Postgres, CPU do banco. Essas métricas **não precisam ser duplicadas** no app, mas a documentação interna do projeto indica claramente onde olhar.

**Why this priority**: Cobre o pedido "tanto de recurso da máquina está sendo usado", reinterpretado para a realidade serverless. Custo de implementação é zero (já vem do provedor); o esforço é só documental. P3 porque é puramente documentação — nada precisa ser construído.

**Independent Test**: Verificar que `docs/observability.md` (ou equivalente) lista links/passos para acessar: (a) Vercel Function Logs, (b) Vercel Analytics, (c) UI de métricas do provedor de Postgres, (d) UI de erros do Sentry, (e) UI do monitor de uptime.

**Acceptance Scenarios**:

1. **Given** um novo dev (ou eu daqui a 6 meses) precisa investigar lentidão, **When** abre o arquivo `docs/observability.md`, **Then** encontra em < 1 minuto: onde ver duration por rota, onde ver conexões do Postgres, onde ver erros agrupados, onde ver uptime histórico.
2. **Given** o dev quer entender o limite atual do plano gratuito, **When** consulta a documentação, **Then** vê quotas relevantes documentadas: Vercel function invocations, Sentry erros/mês, monitor checks/min.

---

### Edge Cases

- **Postgres inalcançável durante escrita de audit**: Como o audit log de mutações de domínio é gravado **na mesma transação** da mutação, indisponibilidade do banco faz a operação inteira falhar — o usuário recebe erro (comportamento atual), não há mutação parcial e nem audit órfão. Comportamento esperado e desejado.
- **Sentry/error tracking inalcançável**: Captura externa é best-effort. Quando a ferramenta estiver fora, os erros continuam aparecendo nos logs estruturados (stdout/Vercel UI) sem agrupamento. Não há retry síncrono que possa bloquear a request original.
- **Cron de purga falha por > 1 dia**: Tabela cresce além de 90 dias temporariamente. Não é problema funcional; próxima execução bem-sucedida normaliza. Operação de purga deve ser idempotente.
- **Volume de audit acima do esperado** (> 500k linhas/mês): Índices em `(user_id, created_at)`, `(entity_type, entity_id, created_at)` e `(request_id)` mantêm consulta rápida. Se o volume crescer para milhões, precisaremos reavaliar particionamento — fora de escopo desta feature.
- **LGPD — pedido de exclusão de dados pessoais de um usuário**: Audit log armazena `user_id`, não `email`/`nome`. Anonimização requer apenas substituir o `user_id` por placeholder (`deleted-user`). Fora de escopo desta feature; documentar como TODO operacional.
- **Header `X-Request-Id` ausente (client antigo)**: O wrapper já gera um UUID quando o header não chega; comportamento mantido.
- **Health endpoint sob carga**: O ping ao Postgres em `/api/health` pode pressionar conexões se um monitor pingar a cada poucos segundos. Frequência alvo é 1 verificação a cada 5 minutos pelo monitor externo + checagem leve (`SELECT 1` com timeout curto).
- **Sessão expirada ou anônima durante mutação tentada**: Mutação rejeitada antes de chegar ao service (já é o comportamento atual via `withApiErrorHandler`); nenhum audit é gravado para a tentativa.
- **Operação que toca múltiplas entidades em uma transação** (ex: criar Studio + Book + Chapters inline): Cada entidade gera uma entrada de audit própria; todas vivem na mesma transação e compartilham o mesmo `request_id`, permitindo agrupar a "operação composta" via filtro por `request_id`.

## Requirements *(mandatory)*

### Functional Requirements

**Logs estruturados de requisição (timing)**

- **FR-001**: O sistema MUST emitir, para cada request encerrada em qualquer rota sob `/api/v1/**`, exatamente um log estruturado em formato JSON contendo no mínimo: `timestamp` ISO 8601, `request_id`, `method`, `path`, `status`, `duration_ms` (inteiro, milissegundos), `user_id` (string ou `null`), `slow` (boolean, `true` quando `duration_ms >= 3000`).
- **FR-002**: O log estruturado MUST NOT incluir corpo de requisição, corpo de resposta, parâmetros sensíveis (senhas, tokens, secrets), nem endereço IP nem User-Agent.
- **FR-003**: O log estruturado MUST ser emitido em `stdout` (capturado nativamente pelo provedor de hosting) e ser pesquisável via UI do provedor por filtro em `request_id`, `user_id` e `path`.
- **FR-004**: O `request_id` MUST ser o mesmo valor presente no header de resposta `X-Request-Id` (gerado/propagado pelo `withApiErrorHandler` da feature 023). Não introduzir novo identificador paralelo.

**Audit log de domínio e autenticação**

- **FR-005**: O sistema MUST persistir, em uma tabela `audit_log` dedicada, uma linha por mutação bem-sucedida de qualquer entidade de domínio: `Studio`, `Book`, `Chapter`, `Narrator`, `Editor`. Inclui criação, atualização, soft-delete, hard-delete, reativação (desarquive por colisão de nome), reordenação de capítulos, transição de status de capítulo e bulk-delete.
- **FR-006**: A escrita do audit log de mutações de domínio MUST ocorrer **dentro da mesma transação** SQL da mutação (via `SavepointUnitOfWork`). Se a transação for revertida, a linha de audit MUST também ser revertida — nenhum audit órfão é admitido.
- **FR-007**: O sistema MUST persistir uma linha de audit para cada evento de autenticação relevante: login bem-sucedido (`auth.login.success`), falha de login (`auth.login.failed`), logout (`auth.logout`), criação de conta (`auth.signup`). Falhas de escrita desses eventos não devem bloquear o evento (best-effort).
- **FR-008**: Cada linha de audit MUST conter exatamente os campos: `id` (uuid), `user_id` (uuid ou `null` para eventos de auth sem usuário ainda resolvido), `action` (string normalizada em formato `<dominio>.<verbo>`, ex: `chapter.update`, `chapter.status.transitioned`, `book.create`, `auth.login.failed`), `entity_type` (string, ex: `chapter`; `null` para eventos de auth genéricos), `entity_id` (uuid ou `null`), `request_id` (string), `created_at` (timestamp com timezone, default `now()`).
- **FR-009**: A tabela `audit_log` MUST NOT armazenar nenhum dos seguintes: corpo do request, diff de campos, endereço IP, User-Agent, email do usuário, qualquer dado pessoal além do `user_id` interno (princípio de minimização).
- **FR-010**: A tabela `audit_log` MUST possuir índices que suportem consulta eficiente por: `(user_id, created_at DESC)`, `(entity_type, entity_id, created_at DESC)`, `(request_id)` e `(created_at)` (este último para suportar a purga).
- **FR-011**: O sistema MUST executar um job de purga **uma vez por dia** que remove de `audit_log` todas as linhas com `created_at` anterior a `now() - 90 dias`. O job MUST ser idempotente.
- **FR-012**: O catálogo completo de valores válidos para `action` MUST ser documentado e tipado em um único local do código (constante exportada), evitando divergência entre services. Adicionar nova mutação de domínio sem registrar seu valor de `action` correspondente deve ser detectado por teste.

**Health check e uptime**

- **FR-013**: O sistema MUST expor a rota pública `GET /api/health` que responde em < 500ms (p95) com payload JSON contendo: `status` (`"ok"` | `"degraded"`), `uptime_seconds` (inteiro), `db` (objeto com `status: "ok" | "down"` e `latency_ms` quando alcançável).
- **FR-014**: O endpoint de health MUST realizar uma checagem efetiva do banco (não apenas declarar `"ok"` estaticamente) — `SELECT 1` com timeout configurável (default 2 segundos).
- **FR-015**: Quando o banco está inalcançável, `/api/health` MUST responder com HTTP `503` (mantendo o payload de detalhamento). A resposta nunca lança exceção — falha de banco é estado normal do endpoint, não erro.
- **FR-016**: O sistema MUST ser monitorado por um monitor externo (UptimeRobot, BetterStack, Vercel Cron + alerta ou equivalente gratuito) que pinga `/api/health` a cada 5 minutos e notifica o dev por email/Slack quando a indisponibilidade ultrapassar 2 minutos. Configuração e provedor desse monitor são decisão de operação (fora do código), mas a feature MUST documentar a configuração escolhida em `docs/observability.md`.

**Error tracking centralizado**

- **FR-017**: O sistema MUST integrar uma ferramenta externa de error tracking (Sentry free tier ou equivalente) configurada com SDK oficial para Next.js, cobrindo:
  - Erros server-side (API routes, server actions, server components, route handlers).
  - Erros client-side (React Error Boundary, rejeições de Promise não tratadas, exceções de JS).
- **FR-018**: Cada evento enviado à ferramenta de erro MUST conter: mensagem, stack trace de-minified via source maps (uploaded no build), `request_id` (quando aplicável), `user_id` (quando autenticado), método e rota (server-side) ou URL atual (client-side).
- **FR-019**: O sistema MUST configurar upload automático de source maps no build de produção, permitindo stack traces legíveis na UI da ferramenta.
- **FR-020**: A captura de erros MUST ser best-effort: indisponibilidade da ferramenta externa não pode bloquear a resposta da requisição original nem o handler do client.
- **FR-021**: O `withApiErrorHandler` (feature 023) MUST encaminhar exceções inesperadas (não `DomainError`, não `ZodError`, não `SyntaxError`) à ferramenta de error tracking. `DomainError` é resposta esperada do domínio — pode ser amostrado ou suprimido para reduzir ruído.

**Documentação operacional**

- **FR-022**: O sistema MUST incluir o arquivo `docs/observability.md` com:
  - Onde acessar cada sinal: logs HTTP, audit log, erros, uptime, métricas de função, métricas do Postgres.
  - Instruções passo-a-passo para investigar um incidente partindo de um `request_id`.
  - Quotas do plano gratuito de cada ferramenta utilizada e impacto previsto.
  - Como anonimizar audit log em caso de pedido de exclusão LGPD.
- **FR-023**: O sistema MUST incluir o arquivo `docs/deploy.md` com o runbook do primeiro deploy em produção e dos deploys subsequentes, contendo:
  - Provisionamento do projeto Vercel e do provedor de Postgres (Supabase/Neon).
  - Lista completa de variáveis de ambiente requeridas (cada uma com origem, formato esperado e impacto se ausente).
  - Configuração do projeto Sentry e upload de source maps no build de produção.
  - Configuração do monitor externo de uptime (provedor, frequência, canal de notificação).
  - Configuração do Vercel Cron para o job de purga de `audit_log`.
  - Procedimento de rollback de uma versão problemática.
  - Checklist de verificação pós-deploy que valida em produção os FRs deploy-dependentes (016, 019).

### Key Entities *(include if feature involves data)*

- **AuditLog**: Registro imutável e write-once de toda mutação de domínio ou evento de autenticação. Atributos: `id`, `user_id` (referência à tabela de usuários, nullable), `action` (string padronizada), `entity_type`, `entity_id`, `request_id`, `created_at`. Nenhuma operação de update é permitida; delete só ocorre via job de purga (linhas com `created_at` < hoje − 90 dias).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Partindo apenas de um `request_id`, o dev encontra todos os artefatos correlacionados (log HTTP + audit + stack trace quando aplicável) em < 5 minutos, validado em um exercício de investigação encenado.
- **SC-002**: 100% das requests encerradas em `/api/v1/**` (sucesso ou erro) produzem exatamente um log estruturado contendo `request_id`, `user_id`, `path`, `status` e `duration_ms`.
- **SC-003**: 100% das mutações de domínio bem-sucedidas produzem exatamente uma linha em `audit_log`, e 100% das mutações revertidas produzem zero linhas (verificado por testes de integração com cenários de rollback).
- **SC-004**: `GET /api/health` responde em < 500ms (p95) sob carga típica e em < 2s mesmo quando o Postgres está degradado (timeout do check).
- **SC-005**: Indisponibilidade da aplicação por mais de 2 minutos resulta em notificação automática ao dev em até 5 minutos do início do incidente, verificado por simulação de queda em homolog.
- **SC-006**: Erros não tratados em produção aparecem na UI da ferramenta de error tracking em < 2 minutos do momento em que ocorreram, com stack trace legível e contexto suficiente (`request_id`, `user_id`, rota) para iniciar investigação sem precisar abrir os logs.
- **SC-007**: A tabela `audit_log` não retém nenhum registro com `created_at` anterior a 90 dias após a execução diária do job de purga, validado por verificação automática.
- **SC-008**: Consulta "todas as ações do usuário X nos últimos 7 dias" e "todas as ações sobre a entidade `chapter:abc` nos últimos 30 dias" executam em < 2 segundos para até 500 mil linhas na tabela.
- **SC-009**: A tabela `audit_log` não contém nenhum campo capaz de armazenar endereço IP, User-Agent, email, conteúdo de campos editados ou diff — verificado por inspeção do schema e por teste que falha se uma coluna desse tipo for adicionada futuramente sem revisão.
- **SC-010**: Um novo dev (ou eu daqui a 6 meses), ao abrir `docs/observability.md`, identifica em < 1 minuto onde olhar cada sinal e como conduzir uma investigação de incidente.

## Assumptions

- **Hosting é Vercel** (Hobby ou Pro). Métricas de função (invocations, duration, error rate, cold starts) ficam acessíveis nativamente via UI do Vercel e não precisam ser duplicadas na aplicação.
- **Postgres é provisionado por um provedor gerenciado** (Supabase/Neon/RDS). Métricas de CPU, memória e conexões ativas do banco são consultadas via UI do provedor — não duplicadas na aplicação.
- **Toda mutação de domínio passa pela camada de Service** (Princípio II da constituição). A escrita do audit log será orquestrada no nível do Service, dentro da mesma transação `SavepointUnitOfWork`, garantindo consistência transacional.
- **`X-Request-Id` já é emitido em toda resposta `/api/v1/**`** (feature 023). Esta feature reusa esse identificador como chave de correlação universal — não introduz um novo.
- **`withApiErrorHandler` já centraliza erros server-side** (feature 023). Esta feature adiciona um único ponto de captura externa dentro desse wrapper para erros não esperados.
- **Acesso retrospectivo aos dados de audit é feito por ferramenta de DB existente** (Drizzle Studio, Supabase Studio, Outerbase, TablePlus, psql) — esta feature **não** constrói UI customizada de auditoria dentro do app. Caso a necessidade surja depois, vira feature separada.
- **Não há requisito de alerta em tempo real para erros nem para performance** nesta fase. O único alerta proativo é uptime. Demais sinais são consulta retrospectiva sob demanda.
- **Volume de audit log esperado é da ordem de centenas de milhares de linhas por mês**, compatível com índices em `created_at` e consulta direta sem particionamento.
- **LGPD**: Audit log armazena apenas `user_id` interno (não dados pessoais diretos). Pedido de exclusão de usuário será atendido por anonimização de `user_id` em uma feature operacional separada — fora de escopo aqui, mas documentado em `docs/observability.md`.
- **A ferramenta de error tracking escolhida é Sentry (free tier)**. Caso a quota gratuita seja insuficiente no futuro, troca de ferramenta é decisão isolada e não invalida a arquitetura.
- **Branch `main` é a única base estável de implantação**; toda mudança desta feature passa por PR contra `main` (conforme constituição).
