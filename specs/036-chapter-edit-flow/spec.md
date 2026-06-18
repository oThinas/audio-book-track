# Feature Specification: Chapter Edit Flow — Keyboard Save & Flexible Status

**Feature Branch**: `036-chapter-edit-flow`

**Created**: 2026-06-17

**Status**: Draft

**Input**: User description: "vamos melhorar o fluxo de edição de capítulos: (1) a tecla Enter salva a edição em qualquer controle da linha de edição (mesmo o select de status focado), contra diretivas de a11y; (2) deixar a transição de status mais flexível, removendo a obrigatoriedade de passar etapa-a-etapa e protegendo apenas a entrada/saída do status 'Pago'."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Mudar o status do capítulo livremente, com "Pago" protegido (Priority: P1)

O operador precisa corrigir ou adiantar o status de um capítulo sem ser obrigado a percorrer cada etapa intermediária uma de cada vez. Hoje a transição é estritamente sequencial, e o operador relatou que só consegue avançar/ajustar o status de forma travada (na prática, conseguindo "destravar" apenas perto de "Concluído"). A mudança permite mover um capítulo diretamente entre quaisquer status **não-pagos**, mantendo proteção apenas no status **Pago** — porque "Pago" trava dados financeiros por motivo de auditoria e histórico.

**Why this priority**: É o ponto que está bloqueando o trabalho diário do operador. Resolve um atrito reportado e tem o maior valor de negócio. Toca regras de domínio e integridade financeira, então exige revisão dupla.

**Independent Test**: Pode ser totalmente testado abrindo a edição de um capítulo, alterando o status para um alvo não-adjacente (ex.: de "Pendente" direto para "Em revisão") e salvando, e verificando que "Pago" continua só acessível a partir de "Concluído". Entrega valor mesmo sem a parte de teclado.

**Acceptance Scenarios**:

1. **Given** um capítulo em "Pendente", **When** o operador define o status como "Em revisão" e salva, **Then** o capítulo é salvo como "Em revisão" sem exigir etapas intermediárias e sem exigir nenhum campo.
2. **Given** um capítulo em "Em revisão", **When** o operador define o status como "Pendente" e salva, **Then** o capítulo é salvo como "Pendente" (movimento "para trás" permitido).
3. **Given** um capítulo com narrador, editor e minutagem (> 0) preenchidos, **When** o operador define o status como "Concluído" e salva, **Then** o capítulo é salvo como "Concluído".
4. **Given** um capítulo sem narrador, sem editor ou com minutagem zero, **When** o operador define o status como "Concluído" e salva, **Then** o salvamento é bloqueado com mensagem indicando o campo faltante e o capítulo permanece no status anterior.
5. **Given** um capítulo em "Concluído" com narrador, editor e minutagem (> 0), **When** o operador define o status como "Pago" e salva, **Then** o capítulo é salvo como "Pago".
6. **Given** um capítulo em "Pendente", "Em edição", "Em revisão" ou "Retake", **When** o operador abre o seletor de status, **Then** a opção "Pago" não é oferecida (só alcançável a partir de "Concluído").
7. **Given** um capítulo em "Pago", **When** o operador abre o seletor de status, **Then** apenas "Pago" e "Concluído" são oferecidos, e escolher "Concluído" exige confirmar a reversão antes de salvar.
8. **Given** um capítulo em "Pago", **When** o operador tenta alterar título, narrador, editor, minutagem ou prazo, **Then** a alteração é bloqueada (dados financeiros permanecem imutáveis).

---

### User Story 2 - Salvar com Enter e cancelar com Esc a partir de qualquer campo (Priority: P2)

O operador, ao editar uma linha de capítulo, quer confirmar a edição apertando **Enter** de qualquer campo (inclusive com o seletor de status focado) e cancelar com **Esc**, sem precisar mover o mouse até o botão "Salvar". Hoje, só os campos de texto (título e minutagem) salvam com Enter; os seletores e o seletor de prazo "engolem" o Enter.

**Why this priority**: É uma melhoria de fluidez/velocidade de edição. Independente da User Story 1 e de menor risco. Mesmo isolada, agiliza o trabalho do operador.

**Independent Test**: Pode ser testado entrando em modo de edição, focando cada controle da linha e apertando Enter/Esc, verificando que o salvamento/cancelamento ocorre conforme o estado aberto/fechado dos popovers.

**Acceptance Scenarios**:

1. **Given** a linha em edição com o campo de título focado, **When** o operador aperta Enter, **Then** a edição é salva (comportamento atual preservado).
2. **Given** a linha em edição com o seletor de status focado e **fechado**, **When** o operador aperta Enter, **Then** a edição é salva.
3. **Given** o seletor de status **aberto**, **When** o operador aperta Enter, **Then** a opção destacada é selecionada e a lista fecha (a edição ainda **não** é salva); um Enter seguinte (com nada aberto) salva.
4. **Given** o calendário de prazo **aberto**, **When** o operador aperta Enter, **Then** a data destacada é escolhida e o calendário fecha (a edição ainda **não** é salva).
5. **Given** qualquer campo focado com nada aberto, **When** o operador aperta Esc, **Then** a edição é cancelada e a linha volta ao modo de visualização sem persistir alterações.
6. **Given** um seletor ou calendário **aberto**, **When** o operador aperta Esc, **Then** o popover fecha mas a linha de edição permanece aberta; um Esc seguinte cancela a edição.
7. **Given** o botão "Cancelar" focado, **When** o operador aperta Enter, **Then** a edição é cancelada (comportamento nativo do botão).
8. **Given** um valor inválido (ex.: título vazio), **When** o operador aperta Enter, **Then** a validação bloqueia o salvamento e exibe o erro do campo.

---

### Edge Cases

- **Enter sem alterações**: apertar Enter sem nenhuma mudança no formulário se comporta como clicar em "Salvar" sem diferença — fecha a linha sem persistir, igual ao comportamento atual do botão.
- **Enter durante salvamento em andamento**: não dispara salvamento duplicado.
- **Preencher campos e status na mesma edição**: definir "Concluído"/"Pago" e preencher narrador/editor/minutagem na mesma linha antes de salvar resulta em salvamento bem-sucedido.
- **Reversão de "Pago"**: ao reverter "Pago" → "Concluído" (com confirmação), os campos financeiros voltam a ser editáveis (comportamento atual preservado); enquanto "Pago", permanecem travados.
- **"Retake" a partir de qualquer status não-pago**: alcançável inclusive a partir de "Pendente" (movimento livre, sem campo obrigatório) — aceito como consequência da flexibilização.
- **Concluído → status anterior**: mover um capítulo para fora de "Concluído" é permitido (movimento livre); o registro de data de conclusão não é apagado (consistente com o comportamento atual de "Concluído" → "Em revisão").

## Requirements *(mandatory)*

### Functional Requirements

#### Teclado na linha de edição (User Story 2)

- **FR-001**: A linha de edição de capítulo MUST salvar a edição quando o operador aperta Enter com o foco em qualquer um de seus controles, **desde que** nenhum seletor (dropdown) ou seletor de data esteja aberto.
- **FR-002**: Quando um seletor de status/responsável ou o calendário de prazo estiver **aberto**, Enter MUST executar a ação própria daquele controle (selecionar a opção/data destacada) e MUST NOT salvar; um Enter seguinte, com nada aberto, MUST salvar.
- **FR-003**: A linha de edição MUST cancelar a edição e descartar alterações não salvas quando o operador aperta Esc com nenhum seletor/calendário aberto.
- **FR-004**: Quando um seletor/calendário estiver aberto, Esc MUST fechá-lo sem cancelar a edição; um Esc seguinte, com nada aberto, MUST cancelar a edição.
- **FR-005**: Enter MUST executar a mesma validação do botão "Salvar"; se a validação falhar, a edição MUST NOT ser salva e o erro do campo relevante MUST ser exibido.
- **FR-006**: Os botões de ação MUST manter o comportamento nativo de teclado: Enter no "Salvar" salva; Enter no "Cancelar" cancela.
- **FR-007**: Enter MUST NOT provocar salvamento duplicado enquanto um salvamento já estiver em andamento.

#### Transições de status (User Story 1)

- **FR-008**: Um capítulo MUST poder transitar diretamente entre quaisquer dois status **não-pagos** (Pendente, Em edição, Em revisão, Retake) sem passar por status intermediários e sem exigir nenhum campo.
- **FR-009**: Transitar um capítulo para "Concluído" MUST exigir narrador atribuído, editor atribuído e minutagem (tempo editado) maior que zero.
- **FR-010**: Transitar um capítulo para "Pago" MUST exigir narrador atribuído, editor atribuído e minutagem maior que zero, E MUST ser permitido **somente** a partir de "Concluído".
- **FR-011**: Um capítulo "Pago" MUST poder sair de "Pago" apenas retornando a "Concluído", e apenas após confirmação explícita de reversão.
- **FR-012**: Os dados financeiros de um capítulo "Pago" (título, narrador, editor, minutagem, prazo) MUST permanecer imutáveis enquanto o capítulo estiver "Pago".
- **FR-013**: O seletor de status MUST oferecer "Pago" apenas quando o capítulo estiver em "Concluído"; para um capítulo "Pago", MUST oferecer apenas "Pago" e "Concluído".
- **FR-014**: O seletor de status MUST permitir selecionar "Concluído"/"Pago" mesmo quando os campos obrigatórios ainda não estiverem preenchidos; a obrigatoriedade MUST ser aplicada no salvamento, com mensagem específica de campo (e não ocultando/desabilitando a opção).
- **FR-015**: Quando uma transição para "Concluído"/"Pago" for bloqueada por campo faltante, a mensagem MUST nomear o campo faltante em português e o capítulo MUST permanecer no status atual.
- **FR-016**: Toda mudança de status MUST continuar sendo registrada para auditoria (quem/quando), como hoje.
- **FR-017**: As mesmas regras de transição MUST ser aplicadas onde quer que a mudança seja tentada — o sistema MUST NOT aceitar uma transição que a interface proíbe, nem proibir uma que a interface oferece (a validação do servidor permanece a fonte da verdade e a interface deve refleti-la fielmente).

#### Governança (dependência)

- **FR-018**: A constituição do projeto MUST ser emendada para refletir o ciclo de vida flexibilizado: ordenação não-obrigatória entre status não-pagos, requisitos de campo (narrador/editor/minutagem) movidos para as bordas de "Concluído"/"Pago", "Retake" não mais restrito a vir de "Em revisão", e "Pago" como único status protegido. A emenda MUST passar por revisão dupla por tocar o modelo financeiro.

### Key Entities *(include if feature involves data)*

- **Capítulo (Chapter)**: unidade central. Atributos relevantes nesta feature — `status` (ciclo de vida), narrador atribuído, editor atribuído, minutagem (`edited_seconds`), prazo, título. Nenhuma entidade nova é criada; apenas as regras de transição de `status` e o comportamento de teclado da linha de edição mudam. A fórmula de ganho (`round(edited_seconds × price_per_hour_cents / 3600)`) **não** muda; o requisito de minutagem > 0 nas bordas "Concluído"/"Pago" preserva a integridade do ganho antes do bloqueio financeiro.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O operador consegue mover um capítulo de "Pendente" para qualquer status não-pago em **um único** salvamento, com **zero** salvamentos intermediários.
- **SC-002**: 100% das tentativas de marcar um capítulo como "Concluído" ou "Pago" sem narrador + editor + minutagem (> 0) são bloqueadas com mensagem clara; **nenhum** capítulo consegue chegar a "Pago" com minutagem zero (ganho nunca é travado em R$ 0 por engano).
- **SC-003**: Nenhum capítulo entra em "Pago" exceto a partir de "Concluído", e nenhum sai de "Pago" exceto para "Concluído" com confirmação — verificado por testes cobrindo todos os pares de status.
- **SC-004**: O operador consegue salvar a linha de edição usando apenas o teclado (Enter) a partir de **todos** os campos e cancelar com Esc a partir de **todos** os campos.
- **SC-005**: Uma correção de status na linha de edição é concluída sem uso do mouse (apenas teclado), do foco do campo ao salvamento.

## Assumptions

- A flexibilização se aplica à linha de edição inline de capítulos (a superfície citada no pedido). Outras superfícies (ex.: ações em massa, criação de capítulo) estão fora de escopo.
- "Retake" passa a ser livremente alcançável a partir de qualquer status não-pago, incluindo "Pendente"; a restrição semântica anterior (só a partir de "Em revisão") é removida.
- Entrar em "Pago" (a partir de "Concluído") **não** exige diálogo de confirmação adicional; apenas **sair** de "Pago" exige confirmação (comportamento atual preservado).
- O diálogo de confirmação de reversão de "Pago" → "Concluído" existente é reutilizado sem mudanças.
- O comportamento das datas de conclusão/pagamento (`completed_at`/`paid_at`) não muda: são definidas na primeira entrada no status e não são apagadas ao reverter (consistente com o comportamento atual).
- As mensagens de erro de campo obrigatório (narrador/editor/minutagem) serão reescritas em PT-BR para o novo contexto ("antes de concluir/pagar"), já que hoje referenciam "antes de iniciar a edição / enviar para revisão".
- A emenda da constituição é feita como parte desta feature (etapa de governança separada) e o requisito de cobertura de testes (≥ 80% geral; 100% para lógica de cálculo de ganho, se tocada) é mantido.
- Quebrar a diretiva de acessibilidade do Enter (Enter salvando em vez de acionar o controle focado fechado) é uma decisão consciente e aceita pelo solicitante.
