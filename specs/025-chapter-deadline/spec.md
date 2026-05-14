# Feature Specification: Data Limite por Capítulo

**Feature Branch**: `025-chapter-deadline`
**Created**: 2026-05-14
**Status**: Draft
**Input**: User description: "Adicionar data limite para cada capítulo"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definir o prazo de um capítulo (Priority: P1)

Como gestor de produção, dentro da tela de detalhes de um livro, abro o modo de edição de uma linha de capítulo e informo a data limite em que esse capítulo deve estar pronto. Ao salvar, a data fica visível na coluna de prazo da tabela. O campo é opcional — posso deixar em branco e definir mais tarde, ou usar o botão "Limpar" no calendário para remover um prazo já gravado.

**Why this priority**: É o núcleo da feature. Sem este fluxo, nada do resto (filtro, badge, indicador de atraso) tem dado para operar. É o MVP absoluto: registrar prazo por capítulo.

**Independent Test**: Abrir um livro qualquer, entrar no modo edição de uma linha, escolher uma data no calendário, salvar, e ver que a célula da coluna "Prazo" exibe a data no formato `DD/MM/YYYY`. Em seguida, voltar ao modo edição, clicar em "Limpar" e confirmar que a célula volta a exibir `—`.

**Acceptance Scenarios**:

1. **Given** um capítulo `pending` sem prazo definido, **When** o gestor entra no modo edição da linha, seleciona uma data futura no calendário e salva, **Then** a célula "Prazo" passa a exibir a data escolhida em formato `DD/MM/YYYY` e a alteração persiste após recarregar a página.
2. **Given** um capítulo com prazo já definido, **When** o gestor abre o modo edição, clica em "Limpar" no popover do calendário e salva, **Then** a célula "Prazo" volta a exibir `—` e o capítulo permanece sem prazo.
3. **Given** um capítulo em qualquer status diferente de `paid`, **When** o gestor seleciona uma data já no passado (por ex., 30 dias atrás), **Then** o sistema aceita normalmente e a célula passa a sinalizá-lo como atrasado.
4. **Given** um capítulo em status `paid`, **When** o gestor abre o modo edição, **Then** o campo de prazo aparece desabilitado (com o mesmo tratamento dos demais campos travados quando pago) e não pode ser alterado.

---

### User Story 2 - Identificar capítulos atrasados sem precisar de filtros (Priority: P1)

Como gestor, ao abrir a tela de detalhes de um livro, identifico imediatamente quais capítulos estão atrasados pela própria aparência da linha — antes mesmo de aplicar qualquer filtro. A célula do prazo destaca essa condição com cor de risco e um ícone, sem depender apenas de cor (acessível por leitor de tela e tooltip).

**Why this priority**: Marcar atraso é o sinal de risco mais importante da feature. Tem que ser visível "à toa", em qualquer listagem da tela do livro.

**Independent Test**: Definir um prazo no passado para um capítulo `pending` e abrir o livro. A linha aparece com o prazo destacado em vermelho, com ícone ao lado, e tooltip informando há quantos dias está atrasado. Em seguida, mover o capítulo para `completed` e verificar que o destaque some.

**Acceptance Scenarios**:

1. **Given** um capítulo com `deadline < hoje` em status `pending`, `editing`, `reviewing` ou `retake`, **When** o gestor visualiza a tabela, **Then** a célula "Prazo" é renderizada com cor de risco, ícone de alerta ao lado da data e tooltip "Atrasado há N dias".
2. **Given** um capítulo com `deadline < hoje` em status `completed` ou `paid`, **When** o gestor visualiza a tabela, **Then** a célula "Prazo" exibe a data sem nenhum destaque visual e sem tooltip de atraso — atraso só se aplica a capítulos com ação pendente.
3. **Given** um capítulo com `deadline >= hoje`, **When** o gestor visualiza a tabela, **Then** a célula exibe a data em cor padrão, sem ícone de alerta, e ao passar o mouse o tooltip mostra "em N dias" (relativo amigável).

---

### User Story 3 - Focar no que precisa ser trabalhado nesta semana (Priority: P1)

Como gestor abrindo a tela do livro logo cedo, ativo o toggle "Foco da semana" para esconder ruído e ver apenas os capítulos que precisam de ação ativa nesta semana civil — somando aos que já estão atrasados. Ao desligar o toggle, volto a ver a lista completa. A escolha persiste na URL, então copio o link e mando para outra pessoa do time abrir no mesmo estado.

**Why this priority**: É o fluxo central de planejamento diário/semanal. Filtro inexistente hoje, alta dor real. Tem prioridade P1 porque destrava o uso prático da feature em times com livros grandes.

**Independent Test**: Em um livro com capítulos em vários status e prazos variados, ativar "Foco da semana" e verificar que a lista filtrada mostra apenas capítulos com status `pending`/`editing`/`reviewing`/`retake` cujo `deadline` esteja entre segunda-feira e domingo da semana corrente OU que estejam atrasados. Capítulos sem prazo somem. Capítulos `completed` ou `paid` somem. Recarregar a página com a URL preservada mantém o filtro ligado.

**Acceptance Scenarios**:

1. **Given** uma tabela de capítulos com casos variados, **When** o gestor ativa "Foco da semana", **Then** ficam visíveis apenas: (a) capítulos atrasados (`deadline < hoje` AND status ∈ {`pending`, `editing`, `reviewing`, `retake`}); (b) capítulos com `deadline` entre segunda e domingo da semana civil corrente AND status ∈ {`pending`, `editing`, `reviewing`, `retake`}; capítulos com `deadline = null`, `completed` ou `paid` ficam ocultos.
2. **Given** o filtro "Foco da semana" está ativo, **When** o gestor recarrega a página, **Then** a URL preserva o estado (`?focus=week`) e o toggle aparece ligado após o carregamento.
3. **Given** o filtro está ativo no início de uma quinta-feira, **When** o gestor mantém a janela aberta até passar para o sábado, **Then** os capítulos exibidos continuam consistentes com a semana civil corrente (segunda a domingo).
4. **Given** "Foco da semana" está ativo e o filtro de agrupamento (`/books/:id` da feature 024) também está aplicado, **When** o gestor visualiza a tabela, **Then** ambos coexistem: os capítulos exibidos respeitam o filtro de foco e o agrupamento aplicado.

---

### User Story 4 - Ver de fora qual livro precisa de atenção esta semana (Priority: P2)

Como gestor na lista geral de livros (`/books`), reconheço sem entrar em cada livro quais têm trabalho previsto/atrasado para esta semana. A tabela de livros ganha uma coluna nova **"Foco"**, e cada linha exibe nessa célula uma badge **"Foco da semana · N"** quando há ao menos um capítulo elegível para o filtro homônimo.

**Why this priority**: Permite triagem entre dezenas de livros sem clicar em cada um. Não bloqueia o uso da feature (P1 já entrega valor), mas eleva o ROI substancialmente para quem gerencia vários livros simultaneamente.

**Independent Test**: Em um conjunto de livros com prazos variados, abrir `/books` e verificar que a célula da coluna "Foco" de cada linha exibe a badge "Foco da semana · N" apenas quando N > 0, com o número exatamente igual ao total que apareceria na tela do livro com o filtro "Foco da semana" ligado.

**Acceptance Scenarios**:

1. **Given** um livro com 3 capítulos no foco da semana, **When** o gestor abre `/books`, **Then** a célula da coluna "Foco" da linha desse livro exibe a badge "Foco da semana · 3" em cor neutra.
2. **Given** um livro com 0 capítulos no foco da semana (todos `paid`, `completed`, sem prazo, ou prazo fora da janela), **When** o gestor abre `/books`, **Then** a célula da coluna "Foco" da linha desse livro permanece vazia (sem badge).
3. **Given** um livro só com capítulos atrasados e nenhum dentro da semana, **When** o gestor abre `/books`, **Then** a badge aparece na célula da coluna "Foco" desse livro e o número reflete os atrasados (porque atrasados entram no foco da semana).

---

### Edge Cases

- **Capítulo `paid` tem `deadline = null`**: célula exibe `—` normalmente; modo edição mantém o campo desabilitado mesmo estando vazio (consistente com os demais campos `paid`-locked).
- **Capítulo `paid` é despromovido para outro status (paid-reversion existente)**: o campo `deadline` volta a ser editável; o valor existente permanece.
- **Migração de capítulos antigos**: capítulos existentes no banco no dia do deploy nascem com `deadline = null`. Não há backfill automático.
- **Filtro "Foco da semana" no fim de semana**: sábado e domingo continuam dentro da semana civil; capítulos com prazo nesses dias seguem visíveis sob o filtro até virar segunda-feira.
- **Data muito distante no futuro**: o sistema aceita datas no futuro até um teto de hoje + 10 anos; valores acima são rejeitados como inválidos (proteção contra digitação acidental tipo `9999-12-31`).
- **Capítulo atrasado em status `retake`**: o status `retake` faz parte do conjunto de "ação pendente"; o capítulo aparece destacado como atrasado normalmente e conta para o filtro "Foco da semana".
- **Combinação de filtros + agrupamento (feature 024)**: filtro "Foco da semana" e agrupamento devem funcionar simultaneamente sem conflito.
- **Mudança de status que torna o capítulo "atrasado" deixa de aparecer no foco**: ao mover um capítulo atrasado para `completed`, ele some imediatamente do filtro "Foco da semana" e da contagem da badge na lista de livros (sem necessidade de recarregar a página).
- **Capítulo com `deadline` igual ao dia corrente (`deadline = hoje`)**: NÃO é considerado atrasado; entra no filtro "Foco da semana" se a semana corrente o cobre.
- **Capítulo concluído antes do prazo**: ao mover para `completed`, perde o destaque visual de atraso (se aplicável) mesmo que o prazo ainda esteja no futuro.

## Requirements *(mandatory)*

### Functional Requirements

#### Domínio do capítulo

- **FR-001**: Capítulo MUST conter um campo opcional `deadline` representando uma data civil (sem horário), capaz de armazenar `null`.
- **FR-002**: O sistema MUST permitir que `deadline` seja atribuído ou alterado por capítulo de forma independente — não há herança automática a partir do livro.
- **FR-003**: O sistema MUST aceitar qualquer data válida no campo `deadline`, incluindo datas no passado e no futuro, desde que dentro do intervalo `[hoje − ilimitado, hoje + 10 anos]`. Datas além de `hoje + 10 anos` MUST ser rejeitadas como inválidas com mensagem em PT-BR.
- **FR-004**: O sistema MUST tratar `deadline` como dado imutável quando o capítulo está em status `paid`, alinhando-se ao mesmo mecanismo já aplicado aos campos atualmente travados nesse status.
- **FR-005**: O sistema MUST permitir reverter `deadline` para `null` em qualquer status diferente de `paid`, via ação "Limpar" no editor de data.

#### Conceito de "atrasado"

- **FR-006**: O sistema MUST classificar um capítulo como **atrasado** se e somente se `deadline IS NOT NULL` AND `deadline < hoje` AND status NOT IN (`completed`, `paid`).
- **FR-007**: A definição de "hoje" para a classificação de atrasado MUST usar o fuso horário de referência do produto (Brasil, `America/Sao_Paulo`), e não o fuso do servidor ou do cliente.

#### Apresentação na tabela `/books/:id`

- **FR-008**: A tabela de capítulos MUST exibir uma coluna fixa "Prazo" sempre visível, sem opção de ocultar.
- **FR-009**: A coluna "Prazo" MUST exibir o valor no formato `DD/MM/YYYY` (locale `pt-BR`) quando o capítulo tem prazo.
- **FR-010**: A coluna "Prazo" MUST exibir um traço (`—`) em cor de baixo destaque quando o capítulo não tem prazo.
- **FR-011**: A coluna "Prazo" MUST oferecer um tooltip em todas as células com prazo definido, contendo descrição relativa em PT-BR — exemplos: "hoje", "amanhã", "ontem", "em N dias", "atrasado há N dias".
- **FR-012**: Quando o capítulo está atrasado (FR-006), a célula MUST renderizar a data em cor de risco junto com um ícone de alerta e `aria-label="Atrasado"`. A indicação MUST permanecer perceptível tanto em modo claro quanto escuro.
- **FR-013**: A coluna "Prazo" MUST NOT oferecer ordenação por header clicável — mantendo o padrão atual da tela de não expor ordenação propositalmente.

#### Edição

- **FR-014**: A edição do `deadline` MUST acontecer dentro do modo de edição existente da linha do capítulo, junto com os demais campos editáveis, e ser salva pela mesma ação de submissão.
- **FR-015**: O editor de data MUST ser um calendário em popover, com locale `pt-BR`, semana começando segunda-feira.
- **FR-016**: O editor de data MUST oferecer uma ação explícita "Limpar" que define o valor como `null`, distinta de "Cancelar".
- **FR-017**: O editor de data MUST aparecer desabilitado quando o capítulo está em status `paid`.

#### Filtro "Foco da semana"

- **FR-018**: A tela `/books/:id` MUST oferecer um toggle único chamado **"Foco da semana"**, que pode estar ligado ou desligado.
- **FR-019**: Quando "Foco da semana" está ligado, a tabela MUST exibir apenas os capítulos que satisfazem: status ∈ {`pending`, `editing`, `reviewing`, `retake`} AND (`deadline` está entre segunda-feira e domingo da semana civil corrente OU o capítulo é considerado atrasado conforme FR-006).
- **FR-020**: Quando "Foco da semana" está desligado, a tabela MUST exibir todos os capítulos do livro (comportamento atual).
- **FR-021**: Capítulos com `deadline = null` MUST NÃO aparecer no filtro "Foco da semana" em nenhuma hipótese.
- **FR-022**: O estado do toggle "Foco da semana" MUST ser refletido na URL via parâmetro de query (proposto: `focus=week`), de forma que recarregar a página ou compartilhar o link preserve o estado.
- **FR-023**: O filtro "Foco da semana" MUST coexistir com o agrupamento da feature 024 — os capítulos exibidos respeitam ambos.
- **FR-024**: A definição de "semana civil corrente" MUST usar segunda-feira como primeiro dia e domingo como último, calculada em fuso `America/Sao_Paulo`, independentemente do locale do servidor.

#### Coluna "Foco" na tabela `/books`

- **FR-025**: A tabela de livros em `/books` MUST exibir uma nova coluna chamada **"Foco"**, posicionada entre as colunas "Capítulos" e "Status". A célula dessa coluna em cada linha MUST renderizar uma badge **"Foco da semana · N"** em cor neutra quando N > 0, onde N é a quantidade de capítulos do livro que satisfariam o filtro "Foco da semana" se aplicado dentro daquele livro.
- **FR-026**: A célula da coluna "Foco" MUST permanecer vazia (sem badge) quando N = 0.
- **FR-027**: A coluna "Foco" MUST ser consistente com a tela de detalhe: para qualquer livro com badge "Foco da semana · N" na sua linha, abrir `/books/:id` e ativar "Foco da semana" MUST exibir exatamente N capítulos.

#### Persistência e API

- **FR-028**: A resposta de capítulo em todos os endpoints de API que retornam capítulos MUST incluir o campo `deadline` no formato `YYYY-MM-DD` ou `null`.
- **FR-029**: O endpoint de update de capítulo MUST aceitar o campo `deadline` (string `YYYY-MM-DD` ou `null`).
- **FR-030**: A tentativa de alterar `deadline` em um capítulo `paid` MUST retornar erro padronizado, alinhado ao tratamento atual dos demais campos travados em `paid`, com mensagem em PT-BR.
- **FR-031**: O endpoint que lista livros (que alimenta `/books`) MUST retornar para cada livro um campo derivado representando a quantidade de capítulos no "Foco da semana", calculado server-side dentro de uma única consulta agregada (sem N+1).

#### Criação inline e migração

- **FR-032**: O fluxo de criação inline de livro (que cria N capítulos junto com o livro) MUST NÃO coletar `deadline`. Capítulos criados via esse fluxo nascem com `deadline = null`.
- **FR-033**: A migração que introduz `deadline` MUST adicionar uma coluna nullable à entidade capítulo sem realizar backfill. Capítulos preexistentes ficam com `deadline = null` até serem editados.

#### Idioma e mensagens

- **FR-034**: Toda mensagem de erro relacionada a `deadline` (data inválida, data acima do teto permitido, tentativa de alterar quando `paid`) MUST estar em português brasileiro e seguir o catálogo de erros existente (feature 023).
- **FR-035**: Toda label visível no produto relacionada a essa feature ("Prazo", "Foco da semana", "Atrasado há N dias", "em N dias", "Limpar") MUST estar em português brasileiro.

### Key Entities

- **Capítulo**: ganha um atributo opcional `deadline` (data civil, sem horário). É a única alteração de modelo nesta feature. Mantém todas as demais regras existentes (atribuição de narrador/editor, ciclo de status, fórmula de ganho).
- **Livro**: na listagem, ganha um atributo derivado (computado, não persistido) representando a contagem de capítulos no "Foco da semana". Esse atributo é exposto na tabela `/books` como célula da nova coluna "Foco". Não muda o schema persistido do livro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Gestor consegue definir o prazo de um capítulo (do clique em "editar linha" até o salvamento) em até **15 segundos** em um dispositivo desktop comum.
- **SC-002**: 100% dos capítulos atrasados aparecem visualmente distintos na tabela sem necessidade de ativar filtro algum.
- **SC-003**: O filtro "Foco da semana", quando ligado, oculta corretamente 100% dos capítulos fora do escopo definido (sem prazo, `completed`, `paid`, prazo fora da semana e não atrasado) — verificado por suíte de teste automatizada cobrindo combinações de status × prazo.
- **SC-004**: A badge "Foco da semana · N" exibida nos cards de `/books` coincide exatamente com a contagem do filtro homônimo na tela de detalhe do mesmo livro, em 100% dos casos observados.
- **SC-005**: Em fluxo manual de QA com um livro contendo 30 capítulos em prazos variados, o gestor identifica os atrasados em até **5 segundos** após carregar a tela (medido por observação direta).
- **SC-006**: Após o deploy, capítulos preexistentes continuam funcionando normalmente (criação, edição, transição de status, cálculo de ganho), com `deadline = null` por padrão. Zero regressões nas suítes de testes existentes.
- **SC-007**: O link compartilhado com `?focus=week` é recarregável e leva qualquer usuário autenticado à mesma visão filtrada em qualquer dispositivo, em 100% dos casos.
- **SC-008**: A consulta de listagem de livros (`/books`) com a contagem de "Foco da semana" mantém latência server-side abaixo de **200 ms** para até 100 livros com até 50 capítulos cada (tamanho realista de produção), validado em ambiente de teste com dados sintéticos.

## Assumptions

- O usuário primário desta feature é o gestor de produção, perfil já modelado pela autenticação existente do projeto. Não há necessidade de novo perfil/permissão.
- A regra "atrasado considera apenas status ativo (`pending`, `editing`, `reviewing`, `retake`)" reflete o ciclo operacional atual; uma vez que um capítulo entra em `completed` ou `paid`, ele não consome mais atenção operacional do gestor — mesmo que tenha sido entregue após o prazo originalmente combinado.
- O fuso de referência do produto é `America/Sao_Paulo` (consistente com o público brasileiro). Caso surja uso fora desse fuso, a feature precisará de revisão.
- O bloqueio de edição de `deadline` em capítulos `paid` estende, por decisão de produto, o conjunto de campos travados em `paid` — embora `deadline` seja operacional e não financeiro, a constituição trata `paid` como ponto de imutabilidade e essa coerência foi priorizada.
- Capítulos preexistentes no banco podem permanecer com `deadline = null` indefinidamente; não há esforço de mutirão para preencher.
- A feature 024 (agrupamento de capítulos) já está em produção; o filtro "Foco da semana" foi projetado para coexistir com ela sem retrabalho na 024.
- Métricas de "% de capítulos entregues no prazo" e qualquer outro relatório histórico baseado em prazo estão fora do escopo desta feature.
- Notificações automáticas (e-mail, push, in-app) sobre prazos próximos ou estourados estão fora do escopo desta feature.
- Bulk-set de prazo (definir o mesmo prazo para vários capítulos selecionados) está fora do escopo desta feature; será reavaliado após observação de uso real.
- O dashboard (`/dashboard`) não recebe métricas de prazo nesta feature; será redesenhado em spec própria.
- Não há requisito de auditoria de alterações de prazo (quem alterou, valor anterior). `updated_at` da entidade capítulo já cobre "foi mexido recentemente".
