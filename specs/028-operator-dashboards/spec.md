# Feature Specification: Dashboards do Operador com Widgets Configuráveis

**Feature Branch**: `028-operator-dashboards`
**Created**: 2026-05-19
**Status**: Draft
**Input**: User description: "quero adicionar dashboards, mas não sei quais 'insights' são interessantes pro usuário. os dashboards devem ter filtros por período."

## Clarifications

### Session 2026-05-19

- Q: Quando o operador clica em "Ver lista" e existem múltiplos livros com capítulos atrasados, qual livro é o destino? → A: O livro que contém o capítulo com `deadline` mais antigo entre todos os capítulos atrasados do sistema; desempate por `book.title` em ordem ascendente.
- Q: Ao chegar na página do livro destino, qual é o comportamento de visualização? → A: Reaproveitar o filtro existente `/books/:id?focus=week`. O hook `useFocusWeekFilter` (e `isInFocusWeek` em `src/lib/domain/chapter-deadline.ts`) já incluem capítulos com `deadline < hoje` em status ativo, então atrasados aparecem naturalmente sem rota nem filtro novo.

---

> Escopo refinado em rodadas de `/grill-me`. Resumo das decisões-chave:
>
> - Uma única página `/dashboard` (home pós-login), com três seções verticais: **Financeira**, **Operacional**, **Retrospectiva**.
> - `book.price_per_hour_cents × chapter.edited_seconds / 3600` representa **receita do operador**, não custo. Toda a UI fala em "a receber" / "receita realizada".
> - Filtro global de período com presets (Hoje, Esta semana, Este mês, Este trimestre, Este ano) e range livre. Default: **Este mês**.
> - Filtro de período **não** afeta funil de status nem card de atrasados — esses são estados atuais (snapshot).
> - Sem comparativo com período anterior.
> - Permissão homogênea: qualquer usuário autenticado vê tudo. Sem RBAC.
> - Cada admin escolhe **quais widgets** quer exibir, em `/settings`, via checkboxes. Estado default: todos ligados.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Saber quanto tenho a receber agora (Priority: P1)

O operador entra no sistema e precisa, em segundos, descobrir quanto dinheiro está acumulado em capítulos prontos (status `completed`) que ainda não foram marcados como `paid`. Esse é o valor que ele deve cobrar dos clientes (estúdios) ou que está pendente de fechamento de mês.

**Why this priority**: É a pergunta financeira mais frequente e a justificativa primária da feature. Sem ela, o operador continua somando capítulos manualmente — fluxo que motivou o pedido original ("não sei quais insights são interessantes" partiu da ausência dessa visualização).

**Independent Test**: Pode ser entregue isoladamente como um único KPI no topo da página `/dashboard`, sem filtros e sem o resto das seções. Operador autenticado abre `/dashboard`, vê o número "A receber agora: R$ X.XXX,XX" calculado a partir do estado atual dos capítulos. Valor reflete a soma de `edited_seconds × price_per_hour_cents / 3600` para todos os capítulos em `completed`.

**Acceptance Scenarios**:

1. **Given** existem 5 capítulos em `completed` somando R$ 1.234,56 de receita e 3 capítulos em `paid` somando R$ 800,00, **When** o operador abre `/dashboard`, **Then** o KPI "A receber agora" exibe "R$ 1.234,56" e ignora os capítulos `paid`.
2. **Given** não há capítulos em `completed`, **When** o operador abre `/dashboard`, **Then** o KPI "A receber agora" exibe "R$ 0,00" sem mensagem de erro.
3. **Given** o KPI "A receber agora" está desligado nas preferências do usuário, **When** o operador abre `/dashboard`, **Then** o KPI não é renderizado e nenhum espaço vazio aparece em seu lugar.

---

### User Story 2 — Acompanhar receita realizada no período (Priority: P1)

O operador quer saber **quanto efetivamente entrou** em um período (mês corrente, trimestre, intervalo customizado). Ele filtra o período no topo do dashboard e vê o total recebido — usado em fechamento de mês, conversa com contador, declaração de imposto.

**Why this priority**: Complementa a US1 com a dimensão temporal. Sem ela, o dashboard não responde "como foi meu mês" — pergunta retrospectiva essencial.

**Independent Test**: Operador altera o filtro de período no topo da página e o KPI "Receita realizada no período" recalcula. Pode ser testado isoladamente sem depender de gráfico temporal ou breakdown.

**Acceptance Scenarios**:

1. **Given** filtro está em "Este mês" e 4 capítulos foram marcados como `paid` no mês corrente somando R$ 2.000,00, **When** o operador olha o KPI "Receita realizada no período", **Then** vê "R$ 2.000,00".
2. **Given** o operador troca o preset de "Este mês" para "Este ano", **When** o filtro é aplicado, **Then** o KPI recalcula e o total cobre todo o ano corrente.
3. **Given** o operador escolhe range customizado de 01/01/2026 a 31/01/2026, **When** confirma o range, **Then** o KPI mostra apenas capítulos com `paid_at` dentro desse intervalo (inclusive nos extremos).
4. **Given** não há capítulos `paid` no período, **When** o operador olha o KPI, **Then** vê "R$ 0,00" e o gráfico temporal exibe estado vazio.

---

### User Story 3 — Identificar gargalos e capítulos atrasados (Priority: P1)

O operador precisa ver, sem clicar em filtros, quantos capítulos estão em cada status (funil) e quantos estão com prazo vencido. Ele clica em "Ver lista" no card de atrasados para ir resolver os incêndios.

**Why this priority**: O dashboard tem propósito **operacional** além do financeiro. Funil + atrasados são o "painel de incêndios" — alta frequência de consulta, ação direta.

**Independent Test**: Sem precisar de filtros nem de cálculos financeiros, o operador vê seis números (um por status) e um card de "atrasados" com contagem + drilldown. Pode ser entregue antes mesmo do filtro de período estar implementado.

**Acceptance Scenarios**:

1. **Given** existem 10 capítulos `pending`, 3 `editing`, 2 `reviewing`, 1 `retake`, 5 `completed`, 8 `paid`, **When** o operador abre `/dashboard`, **Then** o funil exibe esses seis números com seus rótulos PT-BR ("Pendente", "Em edição", "Em revisão", "Retake", "Concluído", "Pago").
2. **Given** 4 capítulos têm `deadline` anterior a hoje e status diferente de `completed` ou `paid`, **When** o operador olha o card "Atrasados", **Then** vê "4 capítulos atrasados" com botão "Ver lista".
3. **Given** nenhum capítulo está atrasado, **When** o operador olha o card "Atrasados", **Then** vê "0 capítulos atrasados" e o botão "Ver lista" fica desabilitado (ou oculto, decisão visual no plano).
4. **Given** o operador clica em "Ver lista" no card de atrasados e existem múltiplos livros com capítulos atrasados, **When** a navegação ocorre, **Then** ele é levado a `/books/<id>?focus=week`, onde `<id>` é o livro que contém o capítulo com `deadline` mais antigo entre todos os atrasados do sistema; em caso de empate de deadline entre livros diferentes, vence o livro com `title` em ordem ascendente.
5. **Given** o operador clica em "Ver lista" e há apenas um livro com capítulos atrasados, **When** a navegação ocorre, **Then** ele é levado a `/books/<id>?focus=week` desse livro.
6. **Given** o operador chegou em `/books/<id>?focus=week` via esse fluxo, **When** a tabela de capítulos renderiza, **Then** o filtro de foco está ativo e os capítulos atrasados são exibidos (comportamento existente do `useFocusWeekFilter`, que inclui `deadline < hoje` em status ativo).

---

### User Story 4 — Ver tendência de receita ao longo do tempo (Priority: P2)

O operador quer um gráfico de linha mostrando a evolução da receita realizada (capítulos `paid`) dentro do período filtrado. A granularidade temporal se adapta automaticamente: diário em períodos curtos, semanal em períodos médios, mensal em períodos longos.

**Why this priority**: Complementa o KPI escalar de receita realizada com a forma temporal. Útil para detectar concentração ("80% do mês veio na última semana") ou sazonalidade. Não é essencial para o MVP da feature — pode ser entregue depois das US1-3.

**Independent Test**: Operador filtra um período e vê o gráfico. Pode ser testado independentemente das tabelas de breakdown.

**Acceptance Scenarios**:

1. **Given** o filtro está em "Este mês" (período de 31 dias ou menos) e há capítulos `paid` em três dias diferentes, **When** o operador olha o gráfico temporal, **Then** vê uma linha com pontos diários, com valores zerados nos dias sem receita.
2. **Given** o filtro está em "Este trimestre" (período entre 31 dias e 6 meses), **When** o gráfico é renderizado, **Then** os pontos representam semanas civis (segunda a domingo, fuso America/Sao_Paulo).
3. **Given** o filtro está em "Este ano" (período ≥ 6 meses), **When** o gráfico é renderizado, **Then** os pontos representam meses civis.
4. **Given** não há receita no período, **When** o gráfico é renderizado, **Then** mostra estado vazio com mensagem "Sem receita no período selecionado".
5. **Given** o operador passa o cursor sobre um ponto, **When** o tooltip aparece, **Then** mostra o intervalo do bucket (ex: "12/05/2026" para dia; "Semana de 11–17/05/2026" para semana; "Maio 2026" para mês) e o valor em BRL.

---

### User Story 5 — Ver ranking por estúdio, narrador ou editor (Priority: P2)

O operador quer entender de onde vem a receita: quais estúdios mais geraram, quais narradores e editores mais trabalharam. Visualizado como três tabelas (uma por dimensão) ou três tabs.

**Why this priority**: Insight estratégico, não operacional. Permite priorizar clientes e identificar gargalos de produção. Frequência de uso menor que US1-3.

**Independent Test**: Operador filtra período e vê três rankings ordenados por receita gerada (descendente). Cada linha tem: nome, capítulos `paid` no período, receita total.

**Acceptance Scenarios**:

1. **Given** existem 15 estúdios com capítulos `paid` no período, **When** o operador olha o breakdown por estúdio, **Then** vê os top 10 ordenados por receita descendente; estúdios fora do top 10 não aparecem.
2. **Given** o operador troca para a tab "Por narrador", **When** a tab é selecionada, **Then** o ranking recalcula sobre os narradores atribuídos aos capítulos `paid` no período.
3. **Given** um narrador está atribuído a um capítulo `paid` que está fora do período filtrado, **When** o operador olha o ranking, **Then** esse capítulo não contribui para os totais do narrador.
4. **Given** um capítulo `paid` não tem editor atribuído, **When** o operador olha o ranking de editores, **Then** esse capítulo é ignorado (não aparece como "sem editor" — fica fora do ranking).

---

### User Story 6 — Escolher quais widgets exibir (Priority: P2)

Cada administrador acessa `/settings` e marca/desmarca os widgets que deseja ver no dashboard. A configuração é por usuário e persiste entre sessões.

**Why this priority**: Personalização aumenta o valor da feature ao longo do tempo (operador remove o que não usa) e desbloqueia evolução futura (novos widgets sem poluir quem já se acostumou com o layout). Não é bloqueante para o MVP — todos os widgets podem nascer ligados e a personalização vir em fase 2.

**Independent Test**: Operador entra em `/settings`, desmarca um widget, salva, abre `/dashboard` em outra aba e confirma que o widget não aparece. Recarrega `/settings` e confirma que o estado persistiu.

**Acceptance Scenarios**:

1. **Given** o operador nunca configurou widgets, **When** abre `/dashboard` pela primeira vez, **Then** vê todos os widgets visíveis.
2. **Given** o operador acessa `/settings`, **When** a página renderiza, **Then** vê uma seção "Dashboard" com nove checkboxes — um por widget — cada um com um **título curto** e uma **descrição** explicando o que o widget mostra.
3. **Given** o operador desmarca "Ranking por editor" e salva, **When** volta a `/dashboard`, **Then** o bloco/tab "Ranking por editor" não aparece. Os outros widgets permanecem inalterados.
4. **Given** dois administradores diferentes têm configurações distintas, **When** cada um abre `/dashboard` na sua sessão, **Then** cada um vê apenas os widgets que escolheu — a configuração não vaza entre usuários.
5. **Given** o operador desmarca **todos** os widgets, **When** abre `/dashboard`, **Then** vê uma mensagem de estado vazio orientando a configurar widgets em `/settings` (com link). A página não fica em branco sem explicação.
6. **Given** um widget está desligado por preferência, **When** o operador abre `/dashboard`, **Then** o sistema **não calcula** os dados desse widget (otimização — não é gasto de banco/CPU para algo que não vai aparecer).

---

### User Story 7 — Ticket médio por capítulo pago (Priority: P3)

O operador quer ver o ticket médio (receita média por capítulo pago) no período. Útil para entender se está cobrando mais ou menos por hora em média.

**Why this priority**: Insight secundário. Já é derivável dividindo "Receita realizada" por "número de capítulos pagos", mas exposto como KPI separado fica mais legível. Pode ser entregue como bônus.

**Acceptance Scenarios**:

1. **Given** 5 capítulos foram pagos no período somando R$ 1.500,00, **When** o operador olha o KPI "Ticket médio", **Then** vê "R$ 300,00".
2. **Given** nenhum capítulo foi pago no período, **When** o operador olha o KPI, **Then** vê "R$ 0,00" sem divisão por zero.

---

### Edge Cases

- **Filtro com `from > to`**: o sistema rejeita o range inválido na UI (validação client antes de submeter) e mantém o filtro anterior.
- **Range muito largo (ex: 10 anos)**: o sistema aceita; o gráfico usa granularidade mensal; performance deve permanecer aceitável (ver SC-002).
- **Capítulo com `paid_at` mas sem `completed_at` (dado anterior ao deploy)**: contabilizado no breakdown e gráfico via `paid_at`. Capítulo `completed` sem `completed_at` (legado) entra no KPI "A receber agora" normalmente, pois esse KPI usa status atual, não timestamp.
- **Backfill de dados existentes**: capítulos já em `completed` ou `paid` antes do deploy recebem `completed_at` e/ou `paid_at` equivalentes ao `updated_at` no momento do migration. Documentado na UI (tooltip ou nota de release) que valores históricos antes da data do deploy têm precisão de dia, não de minuto.
- **Capítulo pago e depois revertido**: fora do escopo desta feature. O ciclo permite até `retake` antes de `completed`, mas `paid` é estado terminal hoje. Caso uma feature futura permita "despagar", `paid_at` deve ser limpo e essa spec não cobre o comportamento.
- **Usuário sem capítulos em nenhum status**: dashboard renderiza todos os widgets com estados vazios apropriados (zeros, mensagens neutras, sem layouts quebrados).
- **Mudança de fuso horário**: agregações temporais (semanas, meses, dias) usam fuso fixo `America/Sao_Paulo` (mesmo da feature 025), independente do fuso do navegador.
- **Filtro persistido na URL e usuário sem permissão**: irrelevante porque não há RBAC; mas a rota `/dashboard` exige sessão válida — sem sessão, redireciona para login (comportamento já existente).
- **Capítulo `paid` cujo livro foi excluído (soft-delete)**: fora do escopo atual; soft-delete de livro não está implementado hoje. Caso venha, a spec dessa feature posterior decide se livros arquivados entram nos cálculos.
- **Soft-deletes existentes (estúdio/narrador/editor)**: rankings devem mostrar essas entidades arquivadas se contribuíram com receita no período filtrado (o capítulo `paid` é fato consumado). UI deve sinalizar visualmente que a entidade está arquivada (ex: rótulo "(arquivado)" ou ícone).

## Requirements *(mandatory)*

### Functional Requirements

#### Página e estrutura

- **FR-001**: O sistema MUST expor uma rota autenticada `/dashboard` acessível apenas a usuários com sessão válida.
- **FR-002**: O sistema MUST exibir `/dashboard` como a home pós-login padrão e como primeiro item da sidebar/menu autenticado.
- **FR-003**: A página `/dashboard` MUST organizar os widgets em três seções verticais nomeadas: "Financeiro", "Operacional", "Retrospectiva" (ordem fixa, top-down).
- **FR-004**: A página MUST funcionar em modo claro e escuro usando os tokens semânticos do tema (sem cores hardcoded).
- **FR-005**: A página MUST usar `<PageContainer>`, `<PageHeader>`, `<PageTitle>` e `<PageDescription>` conforme padrão de páginas autenticadas.

#### Filtro de período

- **FR-006**: O sistema MUST oferecer filtro de período no topo da página com os presets: Hoje, Esta semana, Este mês, Este trimestre, Este ano.
- **FR-007**: O sistema MUST oferecer seleção de range livre (data inicial e final arbitrárias) além dos presets.
- **FR-008**: O filtro de período MUST defaultar para "Este mês" na primeira visita.
- **FR-009**: O estado do filtro de período MUST ser persistido na URL (deep link / refresh preservam a seleção).
- **FR-010**: Os widgets das seções **Financeiro** (parcialmente — ver FR-013) e **Retrospectiva** MUST recalcular ao mudar o filtro.
- **FR-011**: Os widgets da seção **Operacional** (funil e atrasados) MUST ignorar o filtro de período — sempre refletem o estado atual.
- **FR-012**: Datas, semanas e meses do filtro MUST usar fuso fixo `America/Sao_Paulo`, independente do navegador.

#### Widgets financeiros

- **FR-013**: O sistema MUST exibir o KPI "A receber agora" calculado como soma de `chapter.edited_seconds × book.price_per_hour_cents / 3600` para todos os capítulos com `status = completed`, **ignorando o filtro de período** (snapshot atual).
- **FR-014**: O sistema MUST exibir o KPI "Receita realizada no período" calculado como a mesma fórmula sobre capítulos com `status = paid` cujo `paid_at` está dentro do período filtrado.
- **FR-015**: O sistema MUST exibir o KPI "Ticket médio" como (Receita realizada no período) ÷ (número de capítulos `paid` no período). Quando não há capítulos `paid`, o valor exibido MUST ser R$ 0,00 sem disparar divisão por zero.
- **FR-016**: O sistema MUST exibir três rankings (por **estúdio**, por **narrador**, por **editor**) listando o top 10 de cada dimensão ordenado por receita gerada (descendente) dentro do período filtrado.
- **FR-017**: Cada linha de ranking MUST exibir: nome da entidade, número de capítulos `paid` que contribuíram, receita total agregada.
- **FR-018**: Entidades soft-deletadas que contribuíram com receita no período MUST aparecer no ranking com sinalização visual de "arquivado".

#### Widgets operacionais

- **FR-019**: O sistema MUST exibir um "funil de status" com a contagem atual de capítulos em cada um dos seis estados: `pending`, `editing`, `reviewing`, `retake`, `completed`, `paid` — com rótulos PT-BR ("Pendente", "Em edição", "Em revisão", "Retake", "Concluído", "Pago").
- **FR-020**: O sistema MUST exibir um card "Capítulos atrasados" mostrando a contagem de capítulos cujo `deadline` é anterior à data corrente (fuso `America/Sao_Paulo`) e cujo `status` não é `completed` nem `paid`.
- **FR-021**: O card "Capítulos atrasados" MUST oferecer um botão "Ver lista" que navega para `/books/<id>?focus=week`, onde `<id>` é o livro que contém o capítulo atrasado com `deadline` mais antigo do sistema. Critério de desempate: `book.title` em ordem ascendente. O fluxo reaproveita o filtro existente `useFocusWeekFilter` (que já inclui capítulos com `deadline < hoje` em status ativo). Nenhuma rota nem flag de URL nova é criada.
- **FR-021a**: Quando não há capítulos atrasados (contagem = 0), o botão "Ver lista" MUST estar desabilitado ou oculto (decisão visual no plano), e nenhuma navegação ocorre.

#### Widget retrospectivo

- **FR-022**: O sistema MUST exibir um gráfico de linha (ou área) representando a receita realizada (`paid`) bucket a bucket dentro do período filtrado.
- **FR-023**: A granularidade do gráfico MUST ser determinada automaticamente: períodos com duração ≤ 31 dias → buckets diários; entre 31 dias e 6 meses → buckets semanais (semana civil seg-dom no fuso `America/Sao_Paulo`); ≥ 6 meses → buckets mensais.
- **FR-024**: Buckets sem receita MUST aparecer com valor zero (linha contínua, sem "buracos"), exceto se todo o período não tem receita — nesse caso o gráfico exibe estado vazio.
- **FR-025**: O tooltip do gráfico MUST exibir o intervalo do bucket em PT-BR (ex: "12/05/2026", "Semana de 11–17/05/2026", "Maio 2026") e o valor em BRL.

#### Preferências de widgets

- **FR-026**: Cada usuário autenticado MUST ter sua própria configuração de quais widgets exibir; configurações de um usuário não afetam outros.
- **FR-027**: A configuração MUST ser editável em `/settings`, em uma seção nomeada "Dashboard", abaixo das preferências existentes.
- **FR-028**: A configuração MUST listar todos os widgets como checkboxes individuais. Cada checkbox MUST ter um **título curto** e uma **descrição** em PT-BR explicando o que o widget mostra.
- **FR-029**: A lista de widgets configuráveis MUST conter, no mínimo, os seguintes itens (cada um com seu título e descrição):
  - "A receber agora" — KPI de receita acumulada em capítulos prontos ainda não pagos.
  - "Receita realizada no período" — KPI de receita total recebida no período filtrado.
  - "Ticket médio" — Receita média por capítulo pago no período.
  - "Ranking por estúdio" — Top 10 estúdios por receita no período.
  - "Ranking por narrador" — Top 10 narradores por receita no período.
  - "Ranking por editor" — Top 10 editores por receita no período.
  - "Funil de status" — Quantidade atual de capítulos em cada estado do ciclo.
  - "Capítulos atrasados" — Contagem de capítulos com prazo vencido, com link para a lista.
  - "Gráfico de receita" — Linha temporal da receita realizada no período.
- **FR-030**: O estado default para um usuário que nunca configurou MUST ser **todos os widgets visíveis**.
- **FR-031**: A configuração MUST persistir em base de dados associada ao `user_id` (modelo de persistência decidido no plano — extensão do `user_preference` existente ou tabela separada).
- **FR-032**: O sistema MUST evitar calcular dados de widgets que estão desligados na configuração do usuário (otimização: queries condicionais por widget habilitado).
- **FR-033**: Caso o usuário desligue todos os widgets, `/dashboard` MUST exibir um estado vazio com mensagem clara e link para `/settings`.

#### Migração e persistência

- **FR-034**: A entidade `chapter` MUST ganhar duas colunas: `completed_at` (timestamp with timezone, nullable) e `paid_at` (timestamp with timezone, nullable).
- **FR-035**: `completed_at` MUST ser preenchido automaticamente quando o capítulo transita para o status `completed` (na mesma transação que registra a mudança).
- **FR-036**: `paid_at` MUST ser preenchido automaticamente quando o capítulo transita para o status `paid` (na mesma transação que registra a mudança).
- **FR-037**: `completed_at` e `paid_at` MUST entrar em `PAID_LOCKED_FIELDS` — não podem ser editados manualmente após o capítulo virar `paid`.
- **FR-038**: A migration MUST fazer backfill: registros existentes em `completed` ou `paid` no momento do deploy recebem `updated_at` como aproximação para os respectivos timestamps.
- **FR-039**: O sistema MUST ter índices que tornem viáveis queries por `paid_at` em range (índice parcial `WHERE paid_at IS NOT NULL` recomendado, decisão final no plano).
- **FR-040**: A migration MUST ser reversível (down migration que remove as colunas e índices).

#### Permissões e segurança

- **FR-041**: Qualquer usuário autenticado MUST poder ver todos os dados do dashboard (sem RBAC).
- **FR-042**: Usuários não autenticados MUST ser redirecionados para login ao tentar acessar `/dashboard` (comportamento atual da app, herdado).

#### Apresentação e UX

- **FR-043**: Valores monetários MUST ser formatados como moeda brasileira (BRL) — exibidos como reais (centavos divididos por 100 e formatados com locale `pt-BR`).
- **FR-044**: A página MUST renderizar com skeletons por seção durante o carregamento — a página em si não bloqueia até todos os widgets terminarem.
- **FR-045**: Erros de carregamento de um widget específico MUST ficar contidos àquele widget (mensagem de erro local + opção de retry), sem derrubar a página inteira.
- **FR-046**: O sistema MUST **não** usar toasts verdes / `toast.success` para confirmar carregamento ou troca de filtro (a UI já reflete o estado).
- **FR-047**: A página MUST funcionar em viewports mobile (mínimo 320px de largura) e desktop, respeitando os breakpoints do design system existente.

### Key Entities

- **Capítulo (`chapter`) — extensão**: Ganha dois novos campos de timestamp (`completed_at`, `paid_at`) que registram quando o capítulo entrou nesses estados. Esses campos são a fonte primária para agregações retrospectivas.
- **Preferências do Usuário (`user_preference`) — extensão**: Ganha persistência da configuração de widgets do dashboard, associada por `user_id`. Modelo concreto (coluna JSONB, colunas booleanas individuais, tabela `user_dashboard_widget` separada) decidido no plano.
- **Widget de Dashboard (conceito, não entidade de DB)**: Unidade de informação exibida na página `/dashboard`. Cada widget tem chave estável, título PT-BR, descrição PT-BR, seção a que pertence (financeiro / operacional / retrospectiva) e flag de habilitação por usuário.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos operadores que abrem `/dashboard` conseguem identificar em **menos de 5 segundos** quanto têm a receber agora, sem rolar a página em viewport desktop padrão (≥ 1280px de largura).
- **SC-002**: A página `/dashboard` carrega o estado inicial (todos os widgets habilitados, filtro "Este mês") em menos de **2 segundos** em conexão típica (4G, 10 Mbps) com até 5.000 capítulos no banco. Em volumes 10× maiores (50.000 capítulos), a página carrega em menos de **5 segundos**.
- **SC-003**: Trocar o filtro de período recalcula os widgets afetados em menos de **1 segundo** (percebido pelo usuário) com até 5.000 capítulos.
- **SC-004**: 0 erros de divisão por zero, NaN ou "R$ NaN" em qualquer cenário de dados (zero capítulos, zero receita, zero entidades).
- **SC-005**: Personalização persiste corretamente: ao desligar/religar um widget e recarregar a página em outra sessão (mesmo usuário, outro navegador), a configuração permanece. 100% dos cenários testados confirmam isso.
- **SC-006**: O dashboard substitui o cálculo manual de "quanto tenho a receber" — operador relata redução de pelo menos **5 minutos** por consulta (anteriormente feita planilha/listagem manual).
- **SC-007**: Todos os widgets respeitam dark mode — auditoria visual em modo claro e escuro não encontra cores hardcoded ou contrastes ilegíveis (verificação manual + axe-core).
- **SC-008**: O gráfico temporal renderiza corretamente os três níveis de granularidade (diário, semanal, mensal) — verificação manual com períodos representativos para cada faixa.
- **SC-009**: Cobertura de testes ≥ **80%** geral; **100%** sobre a função de cálculo agregado de receita (extensão da lógica existente da fórmula `edited_seconds × price_per_hour_cents / 3600`).
- **SC-010**: Zero regressão financeira: a fórmula de ganho continua determinística e o resultado de qualquer agregação no dashboard bate exatamente com a soma manual dos capítulos que entram no recorte.

## Assumptions

- A página `/dashboard` substitui qualquer placeholder atual de home pós-login. Antes desta feature, `/dashboard` pode existir como rota vazia; este trabalho a preenche.
- Não há export (PDF / CSV / Excel) dos widgets no MVP. Adicionado em feature futura se demandado.
- Não há atualização realtime / push / polling — o dashboard reflete o estado no momento da última requisição. Refresh manual ou navegação retornando à página atualiza.
- Não há comparativo com período anterior (delta %, setas verde/vermelha). Decidido explicitamente.
- Não há drill-down interativo: clicar num ponto do gráfico ou numa linha de ranking não filtra o resto do dashboard. Pode ser proposto em iteração futura.
- Não há agrupamento ou filtro adicional além do período (ex: filtrar dashboard por estúdio específico). Se necessário, vira feature separada.
- O sistema continua single-tenant operador (`book.id` é global, não tem `owner_id`) — não há "meus dados vs. dados de outro operador". Cada admin logado vê todos os capítulos do sistema.
- A coluna `chapter.updated_at` existe ou pode ser usada como fallback para o backfill de `completed_at` / `paid_at`. Caso não exista, o backfill usa `created_at`.
- A página `/settings` já existe (`src/app/(authenticated)/settings/page.tsx`) e pode receber uma nova seção. Layout/estilo dessa seção decidido no plano usando componentes existentes (`<Card>`, `<Checkbox>`, etc.).
- A entidade `user_preference` (uma linha por usuário, unique `user_id`) já existe e pode ser estendida — ou complementada por tabela auxiliar — para guardar widgets habilitados.
- O motor de gráficos (Recharts, Chart.js, visx, etc.) é decisão de plano, não de spec. A spec apenas exige que o resultado seja acessível (tooltips legíveis, navegação por teclado quando aplicável).
- Não é criada rota nova para a listagem de atrasados — o fluxo reaproveita `/books/<id>?focus=week` (visualização existente da feature 025). A query do dashboard que escolhe o livro destino agrega `MIN(chapter.deadline)` entre capítulos atrasados em status ativo, agrupado por `book.id`, ordenado por deadline asc + title asc, e retorna o primeiro.
- Performance assumida: queries agregadas usam índices apropriados e `LEFT JOIN + GROUP BY` em vez de N+1. O plano valida tempos contra SC-002 e SC-003.
- Mudanças no `book.status` materializado (cache) **não** introduzem nova dependência para o dashboard — o dashboard lê `chapter.status` diretamente para o funil. `book.status` continua sendo um cache para outras views.

---

## Notas para fase de planejamento (não vinculantes na spec)

> Estas notas resumem decisões técnicas prováveis para o `/speckit-plan`. Não fazem parte do contrato funcional.

- **Persistência das preferências**: avaliar 3 alternativas — (a) coluna JSONB `dashboard_widgets` em `user_preference`; (b) 9 colunas booleanas em `user_preference`; (c) tabela `user_dashboard_widget` (user_id, widget_key, visible). Tradeoffs: extensibilidade (a) > rigidez schemática (b) > normalização extrema (c). Recomendação preliminar: **(a)** com Zod schema validando as chaves conhecidas.
- **Endpoint(s) do dashboard**: avaliar entre (i) um único `GET /api/v1/dashboard?from=...&to=...&widgets=...` que devolve todos os dados de uma vez; (ii) múltiplos endpoints (`/dashboard/financial`, `/dashboard/operational`, etc.) para carregar em paralelo e isolar erros. Recomendação preliminar: **(ii)** para alinhar com FR-044 (skeletons por seção) e FR-045 (erros locais).
- **Cálculo de buckets temporais**: reaproveitar helpers de `lib/domain/timezone.ts` da feature 025. Funções puras testáveis isoladamente.
- **Migration**: usar `drizzle generate` + `drizzle migrate` (proibido `push`). Backfill em SQL inline na própria migration ou como migration de dados separada.
- **Componentes UI**: usar shadcn/ui para `<Card>`, `<Checkbox>`, `<Tabs>` (se rankings ficarem em tabs), `<Tooltip>`, `<DateRangePicker>`. Verificar com Pencil MCP se há `design.pen` referência para a tela.
- **Gráfico**: candidatos — Recharts, Chart.js, visx. Decisão no plano com base em bundle size (priorizar < 80kb adicional gzipped).

