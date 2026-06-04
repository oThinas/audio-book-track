# Feature Specification: Backup Diário do Banco de Produção

**Feature Branch**: `030-weekly-db-backup`

**Created**: 2026-06-03

**Status**: Draft

**Input**: User description: "implementar backup semanal do Postgres de produção via GitHub Actions agendado (cron `0 6 * * 0` → domingo 03:00 BRT) que executa `pg_dump --format=custom --compress=9` e sobe para Cloudflare R2 (10 GB grátis, sem egress fee). Lifecycle policy de 90 dias no bucket mantém ~12 dumps em rotação. Inclui workflow em `.github/workflows/backup-db.yml`, secrets (`DATABASE_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`) e procedimento de teste de restore em `docs/backup.md` — backup sem restore testado não conta como backup"

## Clarifications

### Session 2026-06-03 (grill-me)

- Q: Qual provedor de Postgres roda a produção? → A: **Neon**, PostgreSQL **16.14** (aarch64). `pg_dump` conecta direto via IPv4; client pinado em major ≥ 16 (recomendação do plano: 17 via PGDG, sobrevive a upgrade futuro).
- Q: Nome e proteção do secret da connection string? → A: Manter **`DATABASE_URL`** como secret do GitHub Actions, com **guarda no workflow**: falha com mensagem clara se o host contiver `-pooler` (a string pooled da Vercel não serve para export consistente — `pg_dump` exige a direct/unpooled).
- Q: Profundidade da validação por execução? → A: **Restore completo round-trip a cada execução**: após o upload, o artefato é **baixado de volta** do armazenamento e restaurado em um banco descartável no próprio job, com sanity queries — só então a execução conta como sucesso. Piso adicional de tamanho mínimo (100 KB; **recalibrado para 10 KB** após a primeira execução real medir ~32 KB para um dump legítimo da base quase vazia — o piso é tripwire para vazio/truncado; legitimidade é provada pelo restore + sanity queries). Repo público → minutos de CI ilimitados, custo zero.
- Q: Como detectar backup que *deixa de rodar* (não só que falha)? → A: **Sentry Crons** como dead man's switch (ferramenta já usada pelo projeto; free tier inclui 1 cron monitor). Check-ins `in_progress`/`ok`/`error`; alerta em check-in ausente cobre falha, não-execução e o auto-disable de scheduled workflows após 60 dias de inatividade do repo. UptimeRobot descartado (heartbeat é feature paga).
- Q: Cadência semanal ou diária? → A: **Diária** (`0 6 * * *` = 03:00 em Brasília). Base atual ~8,4 MB (teto realista < 1 GB) torna o custo idêntico (zero) e derruba o RPO de 7 dias para 1 dia — relevante para dados financeiros. ~90 dumps (~270 MB) em rotação com retenção de 90 dias. Runbook ganha gatilho de reavaliação quando a base se aproximar de ~500 MB.
- Q: Criptografia client-side dos dumps? → A: **Não** — aceita a criptografia at-rest do provedor (AES-256) + API token escopado exclusivamente ao bucket de backup. Para operador único, o risco de perda da chave privada supera a ameaça mitigada. Decisão documentada no runbook e revisável quando houver mais clientes.
- Q: Estado da conta Cloudflare? → A: **Não existe ainda** — o runbook inclui o setup completo: criação de conta, habilitação do R2 (exige cartão de crédito mesmo no free tier), criação do bucket, API token escopado e lifecycle policy de 90 dias.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backup automático diário fora da infraestrutura primária (Priority: P1)

Como operador do sistema, quero que uma cópia completa do banco de dados de produção seja criada automaticamente todo dia, em horário de baixa utilização, e armazenada em um provedor externo independente do provedor do banco — de forma que, mesmo em caso de perda total da infraestrutura primária (exclusão acidental, falha do provedor, corrupção de dados), os dados financeiros e operacionais (capítulos, ganhos, status de pagamento) possam ser recuperados com perda máxima de 1 dia.

**Why this priority**: O sistema registra dados financeiros (ganhos por capítulo, pagamentos a editores) que não podem ser reconstruídos manualmente em caso de perda. Hoje não existe nenhum backup fora do provedor primário — o free tier do provedor não oferece backup confiável. Este é o risco operacional mais grave do projeto; sem esta história, as demais não têm objeto.

**Independent Test**: Pode ser testada disparando manualmente uma execução do processo de backup e verificando que um novo artefato íntegro, identificado por data/hora, aparece no armazenamento externo.

**Acceptance Scenarios**:

1. **Given** o agendamento diário configurado, **When** chega o horário programado (~03:00 horário de Brasília), **Then** uma cópia completa do banco de produção (estrutura + dados) é criada, comprimida e enviada ao armazenamento externo sem qualquer intervenção manual.
2. **Given** um backup concluído com sucesso, **When** o operador lista o conteúdo do armazenamento externo, **Then** o artefato mais recente está presente, tem tamanho acima do piso mínimo e seu nome identifica a data/hora de criação.
3. **Given** a necessidade de um backup fora do ciclo diário (ex: antes de uma migração arriscada), **When** o operador dispara o processo manualmente, **Then** um backup completo é gerado, validado e armazenado da mesma forma que o agendado, sem colisão de nome com o agendado do dia.
4. **Given** qualquer etapa do processo falhando (banco inacessível, geração do dump interrompida, falha de envio, falha na verificação de restauração), **When** a execução termina, **Then** a execução é marcada como falha e o operador recebe notificação — uma falha silenciosa nunca pode parecer sucesso.
5. **Given** o secret de conexão configurado com a string errada (pooler de transação em vez da conexão direta), **When** a execução inicia, **Then** ela falha imediatamente com mensagem acionável indicando qual string usar, antes de gerar qualquer artefato.

---

### User Story 2 - Verificação contínua de restaurabilidade + runbook validado (Priority: P2)

Como operador do sistema, quero que **cada** backup tenha sua restaurabilidade verificada automaticamente — o artefato armazenado é baixado de volta e restaurado em um banco descartável dentro da própria execução — e quero um runbook passo a passo de restauração manual, validado por um teste real, para o cenário de desastre. Backup sem restore testado não conta como backup.

**Why this priority**: Um backup que nunca foi restaurado é apenas uma esperança. A verificação automática por execução garante continuamente que o que está armazenado é restaurável; o runbook validado garante que um humano sob pressão consegue executar a recuperação real. A história 1 sem esta entrega valor incompleto.

**Independent Test**: (a) Verificação automática: forçar um artefato inválido e confirmar que a execução falha na etapa de verificação. (b) Runbook: um operador seguindo exclusivamente o documento baixa o backup mais recente, restaura em banco descartável (nunca em produção) e valida a integridade.

**Acceptance Scenarios**:

1. **Given** uma execução de backup em andamento, **When** o artefato é enviado ao armazenamento externo, **Then** a execução baixa o artefato de volta, restaura-o em um banco descartável e executa verificações de integridade (contagem de tabelas, presença das migrações, amostragem de dados) — e só então declara sucesso.
2. **Given** um artefato corrompido ou incompleto no armazenamento, **When** a etapa de verificação roda, **Then** a execução termina em falha e o operador é notificado.
3. **Given** um backup existente no armazenamento externo, **When** o operador segue o runbook do início ao fim, **Then** obtém um banco restaurado funcional contendo todas as tabelas, dados e estruturas da produção no momento do backup.
4. **Given** a feature em fase de entrega, **When** é feita a revisão final, **Then** existe registro de pelo menos um restore manual completo bem-sucedido via runbook (data, artefato usado, resultado das verificações) documentado no próprio runbook.

---

### User Story 3 - Detecção de backup ausente (dead man's switch) (Priority: P2)

Como operador do sistema, quero ser alertado quando um backup **deixa de acontecer** — não apenas quando falha — para que cenários de não-execução silenciosa (agendamento desabilitado automaticamente pela plataforma após inatividade do repositório, workflow removido, plataforma indisponível) não deixem o sistema semanas sem backup sem ninguém perceber.

**Why this priority**: O modo de falha mais insidioso de um backup agendado é parar de rodar sem erro. A plataforma de automação desabilita agendamentos automaticamente após 60 dias sem atividade no repositório — exatamente o cenário de projeto estável em produção, quando o backup mais importa. Notificação de falha não cobre isso: execução que não acontece não falha.

**Independent Test**: Pausar/desabilitar o agendamento e confirmar que, passada a janela de tolerância, o serviço de monitoramento dispara alerta de check-in ausente ao operador.

**Acceptance Scenarios**:

1. **Given** o monitor de cron configurado com o cronograma esperado, **When** uma execução conclui com sucesso, **Then** o monitor recebe check-in de sucesso e nenhum alerta é gerado.
2. **Given** o monitor configurado, **When** nenhum check-in chega dentro da janela esperada + tolerância (ex: agendamento desabilitado silenciosamente), **Then** o operador recebe alerta de execução ausente.
3. **Given** uma execução que termina em erro, **When** o check-in de erro é enviado, **Then** o operador recebe alerta de falha pelo serviço de monitoramento (além do status de falha na plataforma de automação).

---

### User Story 4 - Retenção automática com custo zero (Priority: P3)

Como operador do sistema, quero que backups com mais de 90 dias sejam removidos automaticamente, mantendo ~90 cópias diárias em rotação, para que o armazenamento permaneça dentro da cota gratuita do provedor indefinidamente, sem manutenção manual.

**Why this priority**: Sem rotação, o armazenamento cresce sem limite e eventualmente gera custo ou atinge a cota. É importante para sustentabilidade, mas o sistema entrega valor (histórias 1-3) mesmo antes da rotação estar ativa.

**Independent Test**: Pode ser testada verificando a configuração de expiração no armazenamento externo e confirmando que objetos com idade superior à janela de retenção são marcados para remoção automática.

**Acceptance Scenarios**:

1. **Given** a política de retenção configurada no armazenamento externo, **When** um backup completa 90 dias de idade, **Then** ele é removido automaticamente sem intervenção do operador.
2. **Given** o ciclo diário em regime permanente, **When** o operador audita o armazenamento, **Then** existem no máximo ~91 backups e o volume total permanece dentro da cota gratuita do provedor (~270 MB no tamanho atual da base).

---

### Edge Cases

- **Banco inacessível no horário agendado** (manutenção do provedor, credencial rotacionada): a execução falha de forma explícita e notifica o operador; a próxima execução diária ocorre normalmente. A perda máxima de cobertura é de 1 dia por incidente isolado.
- **Connection string errada no secret** (pooled em vez de direct): guarda de pré-condição falha a execução imediatamente com mensagem acionável, antes de gerar artefato — evita falhas intermitentes difíceis de diagnosticar.
- **Falha parcial de envio** (dump gerado, upload interrompido): o artefato parcial não passa na verificação round-trip de restauração — a execução é marcada como falha e o operador é notificado.
- **Dump vazio ou truncado**: piso de tamanho mínimo (10 KB no artefato comprimido) reprova antes mesmo da verificação de restauração. Dump de banco errado é capturado pelas sanity queries da verificação de restauração (tabelas, migrations, admin).
- **Agendamento desabilitado automaticamente pela plataforma** (60 dias sem atividade no repositório): o monitor de cron detecta a ausência de check-in e alerta o operador — coberto pela User Story 3.
- **Crescimento da base além da cota gratuita**: o runbook documenta como monitorar o volume ocupado e define gatilho explícito (~500 MB de base) para reavaliar cadência/retenção antes de qualquer risco de cobrança.
- **Credenciais expostas ou rotacionadas**: credenciais vivem exclusivamente como secrets do ambiente de automação; o token do armazenamento é escopado somente ao bucket de backup; o runbook documenta o procedimento de rotação. Nenhuma credencial aparece em código, logs ou nomes de artefatos.
- **Restore em versão diferente do banco**: o runbook fixa a versão do banco de produção (16.14) e orienta restaurar em versão igual ou superior compatível; a ferramenta de export no processo automatizado é pinada em versão major ≥ a do servidor.
- **Duas execuções no mesmo dia** (agendada + manual pré-migração): cada execução gera artefato com identificador próprio (data + hora); não há sobrescrita, e execuções concorrentes são serializadas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema MUST gerar automaticamente, uma vez por dia, em horário de baixa utilização (~03:00 no horário de Brasília), uma cópia completa do banco de dados de produção contendo estrutura e dados.
- **FR-002**: O backup MUST ser armazenado em um provedor de armazenamento externo, independente da infraestrutura do banco de produção, de forma que a perda do provedor primário não implique perda dos backups.
- **FR-003**: O backup MUST ser gerado em formato que permita restauração completa e seletiva (estrutura + dados), e MUST ser comprimido para minimizar o volume armazenado e o tempo de transferência.
- **FR-004**: Cada artefato de backup MUST ter nome que identifique de forma única a data e hora de geração, permitindo localizar rapidamente o backup de um momento específico e evitando colisão entre execução agendada e manual no mesmo dia.
- **FR-005**: Cada execução MUST verificar a restaurabilidade real do artefato armazenado antes de declarar sucesso: o artefato é baixado de volta do armazenamento externo e restaurado em um banco descartável dentro da própria execução, com verificações de integridade (contagem de tabelas, presença das migrações aplicadas, amostragem de dados). Adicionalmente, artefatos abaixo de um piso de tamanho mínimo (10 KB comprimido — tripwire para vazio/truncado, calibrado empiricamente) MUST reprovar imediatamente.
- **FR-006**: A execução MUST validar pré-condições de configuração antes de gerar qualquer artefato — em particular, MUST falhar imediatamente com mensagem acionável se a connection string fornecida for do tipo incompatível com export consistente (string do pooler de transação em vez da conexão direta).
- **FR-007**: Execução com qualquer etapa falha MUST terminar com status de falha visível na plataforma de automação e MUST notificar o operador. Uma falha nunca pode ser silenciosa.
- **FR-008**: O sistema MUST manter um monitor de execução agendada (dead man's switch) em serviço de monitoramento já utilizado pelo projeto: cada execução envia check-in de início, sucesso ou erro; a ausência de check-in dentro da janela esperada + tolerância MUST gerar alerta ao operador. Isso cobre cenários de não-execução (agendamento desabilitado pela plataforma, workflow removido) que notificação de falha não cobre.
- **FR-009**: O operador MUST poder disparar o backup manualmente, fora do ciclo diário, pelo mesmo mecanismo do backup agendado, com as mesmas validações.
- **FR-010**: Backups com mais de 90 dias MUST ser removidos automaticamente pelo provedor de armazenamento (política de expiração), mantendo ~90 cópias diárias em rotação.
- **FR-011**: Todas as credenciais necessárias (acesso ao banco, ao armazenamento externo e ao serviço de monitoramento) MUST ser armazenadas exclusivamente como secrets do ambiente de automação — nunca em código, logs ou histórico de versionamento. O token do armazenamento externo MUST ser escopado exclusivamente ao bucket de backup.
- **FR-012**: O projeto MUST incluir um runbook de restauração em `docs/backup.md` cobrindo: setup inicial do provedor de armazenamento (criação de conta, habilitação do serviço, bucket, token escopado, política de retenção), pré-requisitos de restore, download do artefato, restauração em banco descartável (nunca produção), verificações de integridade pós-restore, procedimento de rotação de credenciais, monitoramento do volume ocupado e gatilho de reavaliação de cadência/retenção (~500 MB de base).
- **FR-013**: A feature MUST ser validada por pelo menos um teste real de restore manual completo seguindo o runbook antes de ser considerada entregue, com registro documentado (data, artefato, resultado das verificações) no próprio runbook.
- **FR-014**: O runbook MUST registrar a versão do banco de produção usada na geração dos dumps (PostgreSQL 16.14) e a regra de compatibilidade para restauração (versão igual ou superior).

### Key Entities

- **Artefato de backup**: cópia completa e comprimida do banco de produção em um instante; atributos: identificador com data/hora de geração, tamanho, formato restaurável. Gerado diariamente ou sob demanda; restaurabilidade verificada na própria execução; expira automaticamente após 90 dias.
- **Agendamento de backup**: definição do ciclo diário (~03:00 horário de Brasília) e do gatilho manual; cada execução tem status visível (sucesso/falha) e histórico auditável na plataforma de automação.
- **Monitor de execução (dead man's switch)**: registro no serviço de monitoramento com o cronograma esperado e janela de tolerância; recebe check-ins de cada execução e alerta o operador quando check-ins param de chegar ou reportam erro.
- **Runbook de restauração (`docs/backup.md`)**: documento operacional com setup do provedor de armazenamento, passo a passo de restore, verificações de integridade, registro do teste de restore validado, rotação de credenciais e monitoramento de cota.
- **Política de retenção**: regra de expiração de 90 dias configurada no provedor de armazenamento; mantém ~90 artefatos diários em rotação dentro da cota gratuita.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A cada dia, um novo backup íntegro e com restaurabilidade verificada aparece no armazenamento externo sem qualquer intervenção manual — taxa de sucesso ≥ 95% das execuções agendadas em uma janela de 3 meses.
- **SC-002**: A perda máxima de dados em um cenário de desastre total da infraestrutura primária (RPO) fica limitada a 24 horas.
- **SC-003**: 100% das execuções declaradas bem-sucedidas incluíram restauração verificada do artefato efetivamente armazenado (round-trip) — nenhum backup "cego" conta como sucesso.
- **SC-004**: Um operador seguindo apenas o runbook consegue completar um restore íntegro em banco descartável em menos de 60 minutos, sem ajuda externa.
- **SC-005**: Pelo menos um restore manual completo foi executado e validado com sucesso via runbook antes da entrega da feature, com registro documentado.
- **SC-006**: Falhas de backup chegam ao conhecimento do operador em até 24 horas; **ausência** de execução (não-execução silenciosa) chega ao conhecimento do operador em até 48 horas, via alerta do monitor.
- **SC-007**: Em regime permanente, o armazenamento mantém no máximo ~91 backups e o custo permanece zero (dentro da cota gratuita de 10 GB — ~270 MB projetados no tamanho atual da base).

## Assumptions

- **Plataforma de automação e destino definidos pelo solicitante**: o agendador é o GitHub Actions do próprio repositório (workflow em `.github/workflows/backup-db.yml`) e o destino é um bucket Cloudflare R2 (cota gratuita de 10 GB, sem taxa de egresso). Essas escolhas são restrições de entrada, não decisões em aberto. Cadência ajustada de semanal para **diária** na sessão de clarificação (cron `0 6 * * *` = 03:00 em Brasília).
- **Banco de produção**: Neon, PostgreSQL **16.14**. A connection string usada pelo backup é a **direct/unpooled** (a pooled de runtime não serve para export consistente). Neon não faz upgrade automático de versão major.
- **Secrets previstos** (GitHub Actions secrets do repositório): `DATABASE_URL` (direct connection string), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, e a URL de check-in do monitor de cron.
- **Dead man's switch**: Sentry Crons (ferramenta já usada pelo projeto; free tier inclui 1 cron monitor — exatamente o necessário). UptimeRobot descartado: heartbeat monitor é feature paga.
- **Repositório público**: minutos de GitHub Actions ilimitados — a verificação de restauração por execução (diária, ~2-5 min) tem custo zero.
- **Volume da base**: ~8,4 MB hoje, teto realista < 1 GB. ~90 dumps em rotação ≈ 270 MB, confortavelmente dentro da cota de 10 GB. O runbook define gatilho de reavaliação em ~500 MB de base.
- **Horário fixo em UTC**: o Brasil não observa horário de verão atualmente; o cron fixo em UTC mantém o backup às 03:00 de Brasília o ano todo. Se o horário de verão for reinstituído, o backup passa a rodar às 04:00 local — desvio aceito.
- **Conta Cloudflare**: não existe ainda — o runbook inclui o setup completo: criação de conta, habilitação do R2 (exige cartão de crédito mesmo no free tier), bucket, API token escopado ao bucket e lifecycle policy de 90 dias. Configuração única, manual, documentada.
- **Criptografia**: aceita a criptografia at-rest do provedor (AES-256) + token escopado; **sem** criptografia client-side — para operador único, o risco de perda da chave privada supera a ameaça mitigada. Decisão registrada no runbook e revisável quando a base de clientes crescer.
- **Teste de restore manual**: a validação humana do runbook é única (na entrega da feature) e executada em banco local/descartável; a restaurabilidade passa a ser verificada automaticamente em **toda** execução (FR-005), tornando re-validações manuais periódicas desnecessárias — o runbook ainda recomenda re-leitura semestral do documento.
- **Recuperação de primeira linha**: o restore window nativo do Neon (free tier, ~24h) cobre erros operacionais recentes (fat-finger delete); os dumps no R2 são a camada de **disaster recovery** (perda do provedor, corrupção antiga, retenção longa). O runbook documenta quando usar cada um.
- **Escopo excluído**: backups incrementais/contínuos (PITR próprio), criptografia client-side do artefato, restore automatizado em produção e alertas em canais externos adicionais (Slack, etc.) estão fora do escopo desta feature.
