# Feature Specification: Double-Click Row Edit

**Feature Branch**: `033-double-click-row-edit`

**Created**: 2026-06-10

**Status**: Draft

**Input**: User description: "quero adicionar a funcionalidade de habilitar a edição da linha ao clicar 2x em qualquer campo. além de habilitar a edição, quero disparar um click no campo clicado. por exemplo: ao clicar 2x em \"status\" de algum capítulo, a linha entra em modo edição e o dropdown de \"status\" se abre."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Editar o status de um capítulo com um duplo-clique (Priority: P1)

O operador está na tabela de capítulos da página de detalhe do livro e quer mudar o status de um capítulo. Hoje ele precisa clicar no lápis para entrar em edição, depois clicar no dropdown de status e só então escolher o novo valor. Com o duplo-clique, ele dá duplo-clique direto sobre o badge de status: a linha entra em modo edição **e** o dropdown de status já abre, pronto para a escolha.

**Why this priority**: É o cenário exato citado na descrição da feature e o caminho de edição mais frequente da tabela. Sozinho já entrega valor — corta uma etapa do fluxo mais comum.

**Independent Test**: Em uma linha em modo visualização, dar duplo-clique no badge de status. Verificar que a linha passa a modo edição e que o dropdown de status está aberto, sem cliques adicionais.

**Acceptance Scenarios**:

1. **Given** uma linha de capítulo em modo visualização, **When** o operador dá duplo-clique na célula de Status, **Then** a linha entra em modo edição e o dropdown de Status abre automaticamente.
2. **Given** o dropdown de Status aberto via duplo-clique, **When** o operador escolhe um novo status válido, **Then** a alteração segue o fluxo de salvamento existente (validação, persistência e atualização visual) sem mudanças.
3. **Given** uma linha em modo visualização, **When** o operador dá duplo-clique na célula de Status de um capítulo `paid`, **Then** a linha entra em edição e o dropdown de Status abre (oferecendo a reversão `paid` → `completed` pelo fluxo já existente).

---

### User Story 2 - Editar qualquer campo de dado entrando direto no controle (Priority: P2)

O operador quer editar qualquer um dos campos de um capítulo (Título, Narrador, Editor, Prazo ou Horas editadas) com o mesmo gesto. Ao dar duplo-clique sobre a célula desejada, a linha entra em edição e o controle daquela célula já fica ativo: dropdowns e o seletor de prazo abrem; campos de texto/número recebem o foco.

**Why this priority**: Generaliza o acelerador para toda a linha, tornando o comportamento previsível e consistente em todos os campos. Depende da mesma mecânica da US1, mas amplia o alcance.

**Independent Test**: Para cada uma das 6 células de dado, dar duplo-clique e verificar que a linha entra em edição e que o controle correto é ativado (dropdown/popover aberto, ou input focado).

**Acceptance Scenarios**:

1. **Given** uma linha em modo visualização, **When** o operador dá duplo-clique na célula de Narrador ou Editor, **Then** a linha entra em edição e o respectivo dropdown abre automaticamente.
2. **Given** uma linha em modo visualização, **When** o operador dá duplo-clique na célula de Prazo, **Then** a linha entra em edição e o popover do calendário abre automaticamente.
3. **Given** uma linha em modo visualização, **When** o operador dá duplo-clique na célula de Título ou de Horas editadas, **Then** a linha entra em edição e o respectivo input recebe foco (sem selecionar o texto existente).
4. **Given** uma linha em modo visualização, **When** o operador dá duplo-clique sobre a alça de arrastar, o checkbox de seleção ou a coluna de Ações, **Then** nada acontece (o duplo-clique é ignorado nessas células).

---

### User Story 3 - Preservar regras de bloqueio, seleção e acessibilidade (Priority: P3)

O recurso deve coexistir com as regras já existentes da tabela sem regressões: capítulos `paid` continuam protegidos nos campos bloqueados, o modo de seleção em massa ignora o duplo-clique, e o botão de lápis permanece como caminho descobrível e acessível por teclado.

**Why this priority**: É a rede de segurança que garante que o acelerador não enfraquece a imutabilidade financeira nem quebra fluxos existentes. Não entrega função nova, mas é obrigatório para liberar com segurança.

**Independent Test**: Exercitar duplo-clique em campos bloqueados de um `paid`, em uma tabela em modo de seleção, e confirmar que o lápis ainda entra em edição via teclado.

**Acceptance Scenarios**:

1. **Given** um capítulo `paid`, **When** o operador dá duplo-clique em Título, Narrador, Editor, Prazo ou Horas editadas (campos travados por `PAID_LOCKED_FIELDS`), **Then** a linha entra em modo edição mas o controle não é ativado; **When** o operador dá duplo-clique em Status, **Then** o dropdown abre (único campo editável em `paid` — reversão).
2. **Given** a tabela em modo de seleção em massa, **When** o operador dá duplo-clique em qualquer célula, **Then** nada acontece (a linha permanece em modo seleção exibindo o checkbox).
3. **Given** uma linha em modo visualização, **When** o operador navega via teclado até o botão de lápis e aciona Enter, **Then** a linha entra em modo edição como antes (o lápis permanece disponível).

---

### Edge Cases

- **Capítulo `paid`**: apenas o dropdown de **Status** ativa (reversão `paid` → `completed`). Título, Narrador, Editor, Prazo e Horas editadas são travados por `paid` (`PAID_LOCKED_FIELDS`) — o duplo-clique entra em edição mas pula a ativação desses controles.
- **Linha já em edição**: o recurso é um acelerador apenas de visualização → edição; um duplo-clique em controles de uma linha que já está editando não tem comportamento adicional (interação normal do controle).
- **Outra linha em edição**: dar duplo-clique em uma linha entra em edição independentemente do estado das demais (múltiplas linhas em edição simultânea segue o comportamento atual, inalterado).
- **Seleção de texto nativa**: o duplo-clique normalmente selecionaria a palavra sob o cursor; o recurso suprime esse resíduo de seleção na célula.
- **Telas de toque**: não há suporte a double-tap; no toque, o lápis continua sendo o caminho de edição.
- **Reordenação por arrastar**: a alça de arrastar fica em célula própria (excluída do duplo-clique), sem conflito entre arrastar e duplo-clicar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Dar duplo-clique em qualquer uma das 6 células de dado (Título, Status, Narrador, Editor, Prazo, Horas editadas) de uma linha de capítulo em modo visualização DEVE colocar a linha em modo edição.
- **FR-002**: Ao entrar em edição via duplo-clique, o controle correspondente à célula clicada DEVE ser ativado automaticamente, conforme o tipo:
  - Status, Narrador, Editor → o dropdown abre;
  - Prazo → o popover do calendário abre;
  - Título, Horas editadas → o input recebe foco, **sem** selecionar o texto existente.
- **FR-003**: Dar duplo-clique nas células de alça de arrastar, checkbox de seleção e coluna de Ações NÃO DEVE disparar edição nem qualquer ativação.
- **FR-004**: O botão de lápis (Editar) DEVE permanecer disponível em modo visualização como caminho alternativo de entrada em edição — descobrível visualmente e acessível por teclado.
- **FR-005**: Em capítulos com status `paid`, o duplo-clique DEVE entrar em modo edição (consistente com o lápis); a ativação automática DEVE ser pulada para **todos** os campos travados por `paid` — o conjunto `PAID_LOCKED_FIELDS` (Título, Narrador, Editor, Prazo, Horas editadas). **Apenas o controle de Status** ativa em `paid` (Status não é travado — oferece a reversão `paid` → `completed`). A linha entra em edição mesmo quando a ativação é pulada. A fonte de verdade do bloqueio é `PAID_LOCKED_FIELDS`, não o estado `disabled` (parcial) do formulário de edição.
- **FR-006**: Quando a tabela está em modo de seleção em massa, o duplo-clique nas células NÃO DEVE ter efeito.
- **FR-007**: O duplo-clique NÃO DEVE deixar resíduo de seleção de texto nativa do navegador na célula clicada.
- **FR-008**: O recurso é um acelerador exclusivo de visualização → edição; uma vez em modo edição, o duplo-clique sobre os controles NÃO DEVE ter comportamento adicional além da interação normal do controle.
- **FR-009**: O recurso DEVE funcionar via duplo-clique de mouse; não há requisito de suporte a double-tap em telas de toque, onde o lápis permanece o caminho.
- **FR-010**: Os fluxos de salvar, cancelar, validação de campos e reversão de `paid` em modo edição DEVEM permanecer inalterados — apenas a forma de **entrar** em edição e de **ativar** o campo é adicionada.
- **FR-011**: O recurso é puramente de interação de UI: NÃO DEVE haver mudança em dados persistidos, contratos de API, modelo de domínio ou cálculo de ganho.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Editar o status de um capítulo a partir da visualização passa a exigir no máximo 2 interações do operador (duplo-clique + escolha no dropdown), contra 3 hoje (clique no lápis, clique no dropdown, escolha).
- **SC-002**: 100% das 6 células de dado abrem o dropdown/popover correto ou focam o input correto ao receberem duplo-clique.
- **SC-003**: A partir do estado de visualização, ativar o controle de um campo específico passa a exigir uma única ação de mouse (o duplo-clique), sem cliques intermediários.
- **SC-004**: Zero regressões — salvar, cancelar, validação, reversão de `paid`, modo de seleção em massa, reordenação e o botão de lápis continuam funcionando como antes da mudança.
- **SC-005**: Em capítulos `paid`, o duplo-clique nunca ativa controles de campos travados (`PAID_LOCKED_FIELDS`: Título, Narrador, Editor, Prazo, Horas editadas) — apenas Status ativa. A imutabilidade financeira é preservada.

## Assumptions

- O recurso é voltado a desktop/mouse; o suporte a double-tap em telas de toque está fora de escopo e o lápis permanece como caminho nesses contextos.
- A infraestrutura de modo edição existente (a linha em modo edição, o gerenciamento de estado view/edit da linha e os controles visuais de cada campo) é reutilizada; os controles passam a aceitar um sinal de "abrir/focar automaticamente" ao entrar em edição.
- A possibilidade de múltiplas linhas em edição simultânea é o comportamento vigente e permanece inalterada.
- Não há mudanças de schema, API ou modelo de domínio — a feature é puramente de apresentação/interação.
- Usuários de teclado e de leitor de tela continuam usando o botão de lápis (Tab + Enter) para entrar em edição; esse caminho permanece inalterado.
