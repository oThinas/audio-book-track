# Feature Specification: Test Database Isolation

**Feature Branch**: `016-test-db-isolation`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Isolamento de banco de dados para testes E2E e separação entre dados de dev e de teste"

## Clarifications

### Session 2026-04-17

- Q: Estratégia de reset entre testes E2E de um mesmo worker → A: `TRUNCATE` nas tabelas de domínio, preservando as linhas do admin em `user`/`account`/`session` (admin não é apagado nem recriado entre testes).
- Q: Hospedagem da base de teste → A: Mesmo servidor Postgres do dev, apenas banco com nome distinto (`audiobook_track` para dev, `audiobook_track_test` para testes). CI sobe um Postgres e cria ambos.
- Q: Schema dos testes integration → A: `public` (schema default da base de teste). Integration usa `BEGIN`/`ROLLBACK`; E2E usa `e2e_w0..3`. Migrations aplicadas em `public` uma vez no setup.
- Q: Número de workers Playwright no CI (runner free-tier GitHub) → A: 1 (serial). Local mantém default do Playwright (até 4). Paralelismo real fica reservado a ambiente local; CI prioriza previsibilidade de recursos.
- Q: Mecanismo de detecção de recurso insuficiente no CI → A: Timeout nativo do Playwright é suficiente; não há probe ativo de memória/CPU.
- Q: Convenção de sufixo para arquivos de teste → A: `.spec.ts` é o padrão para TODOS os testes (unit, integration, E2E); arquivos `*.test.ts` existentes serão renomeados no curso da feature.
- Q: Frequência de validação de flakes após merge → A: 1 execução local é suficiente (isolamento por schema elimina a classe principal de flakes; flakes residuais são bugs de escrita do teste, não de infra).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bancos de dev e teste fisicamente separados (Priority: P1)

Como desenvolvedor, quando executo a suíte de testes, os dados do banco de desenvolvimento nunca são lidos, truncados ou sobrescritos, e vice-versa. A base de dev pode acumular dados de exploração manual sem risco de perda entre execuções de teste.

**Why this priority**: É a proteção de dados mais básica da feature. Sem esse limite físico, qualquer bug em fixture ou teardown de teste pode apagar o progresso manual do desenvolvedor no ambiente local.

**Independent Test**: Popular o banco de dev com registros manuais, executar a suíte completa de testes (unit + integration + E2E), confirmar que os registros manuais continuam intactos e que nenhum registro criado durante os testes aparece na base de dev.

**Acceptance Scenarios**:

1. **Given** banco de dev com registros criados pelo desenvolvedor, **When** a suíte completa de testes é executada, **Then** os registros de dev permanecem inalterados e nenhum dado de teste vazou para a base de dev.
2. **Given** ambiente de teste não configurado (variáveis de teste ausentes), **When** qualquer comando de teste é iniciado, **Then** a execução falha com mensagem clara antes de qualquer conexão ao banco de dev.
3. **Given** duas bases configuradas corretamente, **When** o desenvolvedor roda `bun run dev`, **Then** apenas a base de dev é acessada; a base de teste permanece ociosa.

---

### User Story 2 - Testes E2E paralelos sem interferência (Priority: P1)

Como desenvolvedor, quando rodo a suíte E2E com múltiplos workers em paralelo, cada worker opera em um espaço de dados isolado, de modo que um teste em um worker jamais lê, altera ou exclui dados de outro worker. Testes concorrentes que criam, editam e deletam entidades com nomes iguais não colidem.

**Why this priority**: Habilita paralelismo real no E2E (local e CI), reduz o tempo da suíte e elimina a classe inteira de flakes por interferência. Sem isolamento por worker, `fullyParallel: true` produz falhas intermitentes.

**Independent Test**: Executar a suíte E2E com 4 workers em paralelo, onde múltiplos testes criam entidades com o mesmo nome simultaneamente; todos os testes devem passar consistentemente em 10 execuções consecutivas.

**Acceptance Scenarios**:

1. **Given** 4 workers rodando em paralelo, **When** dois testes em workers diferentes criam usuários com o mesmo username ao mesmo tempo, **Then** ambos passam sem conflito de unique constraint.
2. **Given** um teste que deleta todas as linhas de uma tabela, **When** outro worker está executando testes que leem da mesma tabela, **Then** o segundo worker não enxerga a deleção do primeiro.
3. **Given** a suíte E2E termina (sucesso ou falha), **When** o desenvolvedor inspeciona o banco de teste, **Then** nenhum artefato de execução permanece (schemas de worker foram removidos).

---

### User Story 3 - Testes individualmente independentes (Priority: P1)

Como desenvolvedor, cada teste (unit, integration ou E2E) começa com um estado previsível e determinístico, independente da ordem de execução, de testes anteriores que falharam, ou de execuções interrompidas. Rodar um teste isolado produz o mesmo resultado que rodá-lo após toda a suíte.

**Why this priority**: Garantia de que falhas são reproduzíveis e que a ordem dos testes não é um fator oculto. Sem isso, debugging vira caça a fantasmas.

**Independent Test**: Executar um teste específico isoladamente, depois rodá-lo no meio da suíte completa, depois rodá-lo após um teste que falhou intencionalmente — resultado deve ser idêntico nas três execuções.

**Acceptance Scenarios**:

1. **Given** um teste E2E que cria um estúdio chamado "Acme", **When** o teste é executado duas vezes seguidas, **Then** a segunda execução passa sem erro de duplicata.
2. **Given** um teste integration que falha na metade, **When** o próximo teste inicia, **Then** ele enxerga estado limpo e passa.
3. **Given** execução da suíte interrompida por Ctrl+C, **When** a suíte é reiniciada, **Then** não há lixo residual que afete os novos testes.

---

### User Story 4 - Seed de teste estável e mínimo (Priority: P2)

Como desenvolvedor, quando eu adiciono uma nova entidade de domínio (livro, capítulo, narrador, etc.), eu não preciso atualizar o script de seed de teste. O seed de teste contém apenas o mínimo absoluto para que os testes possam autenticar; dados de domínio são criados pelos próprios testes via factories reutilizáveis.

**Why this priority**: Reduz custo contínuo de manutenção e desacopla testes de um fixture global frágil. Cada teste é autodocumentado sobre seus próprios pré-requisitos.

**Independent Test**: Inspecionar o arquivo de seed de teste após adicionar três novas entidades (Studio, Book, Chapter); ele deve continuar inalterado, contendo apenas o usuário admin.

**Acceptance Scenarios**:

1. **Given** uma nova tabela é adicionada ao schema, **When** o desenvolvedor termina a implementação da feature, **Then** o seed de teste continua com o mesmo conteúdo (apenas `admin/admin123`).
2. **Given** um teste precisa de um livro, **When** o teste é escrito, **Then** ele usa uma factory (`createTestBook`) que já existe ou é adicionada uma vez em `__tests__/helpers/factories.ts`.
3. **Given** o seed de dev é expandido com livros de exemplo, **When** os testes rodam, **Then** esses livros de dev não aparecem na base de teste.

---

### User Story 5 - Paralelismo local e execução serial no CI (Priority: P2)

Como desenvolvedor, a suíte E2E roda com múltiplos workers em paralelo **no ambiente local** (máquinas com recursos folgados), oferecendo feedback rápido durante desenvolvimento. **No CI**, a suíte roda serial (1 worker) para garantir previsibilidade no runner free-tier do GitHub Actions (2 vCPU / 7 GB RAM), onde iniciar 4 Next.js simultâneos é instável.

**Why this priority**: Feedback rápido local é valioso; CI serial é mais importante do que CI rápido em um runner apertado. Depende dos Stories 1–3 estarem funcionando.

**Independent Test**: Localmente, rodar a suíte E2E e confirmar que 4 workers executam em paralelo; no CI, abrir um PR e confirmar que a suíte executa com 1 worker serial, sem flakes por exaustão de recurso.

**Acceptance Scenarios**:

1. **Given** ambiente local com ≥4 CPUs, **When** o desenvolvedor roda `bun run test:e2e`, **Then** o Playwright inicia até 4 workers em paralelo e o tempo total é menor que a execução serial equivalente.
2. **Given** pipeline CI no GitHub Actions free-tier, **When** o workflow roda o job de E2E, **Then** o Playwright usa exatamente 1 worker e a suíte completa sem falhas de recurso.
3. **Given** um teste individual falha por timeout no CI, **When** o relatório é gerado, **Then** o log indica claramente timeout do Playwright (sem flakes silenciosos).

---

### Edge Cases

- **Schema de worker não é removido por queda do processo**: se o processo de teste é morto (`kill -9`, crash, timeout do CI), schemas de worker ficam órfãos no banco. O sistema deve ter uma forma de limpeza idempotente a cada início de suíte (limpar schemas de workers de execuções anteriores antes de criar novos).
- **Migration falha ao ser aplicada em um schema de worker**: se a migration quebra no meio da aplicação em um schema novo, o worker deve abortar com erro claro, não deixar o schema em estado parcial.
- **Pool de conexões exaurido**: com 4 workers, cada um com seu Next.js, o número de conexões Postgres simultâneas cresce. O sistema deve respeitar o limite do banco e falhar cedo com mensagem útil.
- **Porta em uso**: se a porta designada para um worker está ocupada, o worker deve falhar rápido com instrução clara.
- **Banco de teste não existe**: se `TEST_DATABASE_URL` aponta para uma base inexistente, o sistema cria/migra automaticamente ou falha com instrução clara sobre como criar.
- **Desenvolvedor roda `bun run db:migrate` apontando para dev**: não deve afetar a base de teste. Migrations de teste são aplicadas apenas durante o bootstrap da suíte.
- **Admin é deletado durante um teste**: o reset entre testes deve garantir que o admin continue existindo (seja preservando-o no truncate, seja recriando-o).

## Requirements *(mandatory)*

### Functional Requirements

#### Separação de bases

- **FR-001**: O sistema MUST usar duas bases Postgres distintas no mesmo servidor, identificadas por nomes diferentes: `audiobook_track` para desenvolvimento (`DATABASE_URL`) e `audiobook_track_test` para testes (`TEST_DATABASE_URL`). O isolamento é garantido pelo fato de cada `database` Postgres possuir seu próprio catálogo e espaço de schemas, sem acesso cruzado.
- **FR-002**: Comandos de teste (unit com DB, integration, E2E) MUST usar exclusivamente a base de teste; nunca ler nem escrever na base de dev.
- **FR-003**: O sistema MUST falhar com mensagem clara quando `TEST_DATABASE_URL` não estiver configurado em ambiente de teste, antes de qualquer conexão ou comando ser executado.
- **FR-004**: A aplicação em desenvolvimento (`bun run dev`) MUST continuar usando apenas `DATABASE_URL` e ignorar `TEST_DATABASE_URL`.

#### Isolamento por worker no E2E

- **FR-005**: O sistema MUST atribuir um schema Postgres único a cada worker Playwright, nomeado de forma determinística a partir do índice do worker (ex: `e2e_w0`, `e2e_w1`).
- **FR-006**: O sistema MUST aplicar todas as migrations em cada schema de worker antes de os testes daquele worker começarem.
- **FR-007**: O sistema MUST iniciar uma instância independente da aplicação por worker, em porta distinta, com `search_path` apontando para o schema correspondente.
- **FR-008**: O sistema MUST remover (`DROP SCHEMA CASCADE`) o schema do worker ao final da execução, em caso de sucesso ou falha.
- **FR-009**: O sistema MUST, no início de cada suíte E2E, remover schemas órfãos de execuções anteriores (por exemplo, se um processo foi morto abruptamente).

#### Isolamento por teste

- **FR-010**: Entre testes E2E de um mesmo worker, o sistema MUST executar `TRUNCATE ... RESTART IDENTITY CASCADE` em todas as tabelas de domínio do schema daquele worker, **excluindo** as tabelas de autenticação (`user`, `account`, `session`), de modo a preservar as linhas do usuário admin sem precisar recriá-lo entre testes.
- **FR-011**: Entre testes integration, o sistema MUST manter o isolamento via `BEGIN`/`ROLLBACK` (comportamento atual), agora operando sobre o schema `public` da base de teste. Migrations são aplicadas em `public` uma única vez durante o setup da base de teste, independentemente dos schemas `e2e_w*` dos workers.
- **FR-012**: A ordem de execução dos testes MUST ser irrelevante para o resultado: cada teste deve partir de um estado previsível, idêntico a quando executado isoladamente.

#### Seed

- **FR-013**: O sistema MUST ter dois scripts de seed distintos: um para dev (pode conter dados de exemplo) e um para teste (contém apenas o usuário admin com credenciais conhecidas).
- **FR-014**: O seed de teste MUST ser estável: não requer atualização quando novas entidades de domínio são adicionadas ao schema.
- **FR-015**: Testes que precisam de entidades de domínio MUST criá-las via factories reutilizáveis em `__tests__/helpers/factories.ts`, não via seed global.

#### CI

- **FR-016**: O Playwright MUST ser configurado com `workers: process.env.CI ? 1 : undefined` — 1 worker serial no CI, default do Playwright (baseado em CPU, até 4) localmente.
- **FR-017**: O pipeline MUST preparar automaticamente a base de teste (criar se não existe, aplicar migrations) antes de rodar a suíte.
- **FR-018**: Em caso de falha de recurso (memória, porta, pool de conexões) no CI, o pipeline MUST reportar falha via timeout nativo do Playwright; não há probe ativo de recursos.

#### Ergonomia e segurança

- **FR-019**: O sistema MUST fornecer um comando de script (ex: `bun run db:test:setup`) que cria a base de teste, aplica migrations e executa o seed de teste, idempotente.
- **FR-020**: O sistema MUST usar `drizzle-kit generate` + `migrate` para todas as operações de schema; `drizzle-kit push` é proibido.
- **FR-021**: Mensagens de erro do bootstrap de testes MUST ser acionáveis (dizem o que falta configurar ou como corrigir).

### Key Entities

- **Dev Database**: base Postgres para desenvolvimento local, acumula dados de exploração, não é tocada por testes.
- **Test Database**: base Postgres dedicada a testes (integration e E2E), pode ser recriada a qualquer momento sem perda de valor.
- **Worker Schema**: namespace Postgres isolado dentro da Test Database, vinculado a um worker Playwright, contém uma cópia completa do schema da aplicação.
- **Admin Seed User**: único registro garantido pelo seed de teste, necessário para fluxos de login.
- **Test Factory**: função reutilizável que cria uma entidade de domínio com valores padrão razoáveis, usada pelos testes em vez de seeds globais.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos dados criados manualmente na base de dev permanecem intactos após execução da suíte completa de testes.
- **SC-002**: A suíte E2E executa sem flakes em 1 execução local com 4 workers (isolamento por schema elimina a classe principal de flakes) e em PRs consecutivos do CI com 1 worker.
- **SC-003**: Um teste E2E específico produz o mesmo resultado quando executado isoladamente, no meio da suíte, e após uma falha — em 100% das execuções.
- **SC-004**: Adicionar uma nova entidade de domínio ao projeto não exige nenhuma mudança no script de seed de teste.
- **SC-005**: Localmente (máquina com ≥4 CPUs), o tempo total da suíte E2E com 4 workers diminui em ao menos 40% em relação à execução serial equivalente. Alvo no CI: não aplicável (CI é serial por design).
- **SC-006**: Ao final de cada execução de teste (sucesso ou falha), nenhum schema de worker permanece no banco de teste.
- **SC-007**: Rodar testes sem `TEST_DATABASE_URL` configurado falha em menos de 1 segundo com mensagem explicando o que fazer.

## Assumptions

- Postgres é o único banco suportado; schemas são um recurso nativo da plataforma já disponível.
- O desenvolvedor local tem permissões para criar e dropar schemas e bases no servidor Postgres configurado.
- A aplicação Next.js lê a string de conexão uma vez no startup; passar o schema via `options=-c search_path=...` na connection string é suficiente para isolar queries sem mudança no código de domínio.
- A suíte E2E roda com Playwright em processo Node separado por worker; isso permite envs distintos por worker sem mudanças no framework.
- O runner do GitHub Actions padrão (2 vCPU / 7 GB RAM) suporta 4 instâncias simultâneas de Next.js em modo dev leve; se não suportar, o número de workers no CI é o primeiro parâmetro a ajustar sem alterar o resto do design.
- O padrão de factories já estabelecido em `__tests__/helpers/factories.ts` (ex: `createTestUser`, `createTestSession`) é o modelo para novas factories de domínio.
- Migrations existentes são idempotentes o suficiente para serem aplicadas em schemas vazios recém-criados, sem dependência de dados pré-existentes.
- O seed de teste preserva apenas o usuário admin; qualquer outro registro pré-existente no schema do worker pode ser recriado ou descartado entre testes.
