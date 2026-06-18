# Feature Specification: List Row Enter/Exit Animations (Fase A)

**Feature Branch**: `037-list-row-animations`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Animação de entrada e saída de linhas de lista (Fase A das animações de UI). Quando uma linha é adicionada ou removida nas tabelas de listagem do app — capítulos (na página de detalhe do livro), narradores, editores e estúdios — a linha deve animar suavemente sua entrada e sua saída, em vez de aparecer/sumir instantaneamente. Respeitar prefers-reduced-motion, funcionar em modo claro e escuro, sem dependência nova. Escopo restrito a entrada/saída de linhas; sem transição de página (Fase B), sem reordenação de capítulos (Fase B), sem modo de edição (descartado)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Entrada animada ao adicionar uma linha (Priority: P1)

Ao adicionar um item em qualquer das quatro listagens em tabela do app — capítulos (na página de detalhe do livro), narradores, editores e estúdios — a nova linha surge com uma transição suave de entrada (esmaece e desliza levemente para a posição) em vez de "pular" instantaneamente para a tela. Isso reforça, pela própria UI, que o item foi criado — coerente com a regra do projeto de não usar toast de sucesso.

**Why this priority**: É a ação positiva mais frequente nessas telas e o caso de maior retorno percebido. O feedback de sucesso precisa vir da própria efetivação visual; a entrada animada é exatamente esse sinal.

**Independent Test**: Criar um item em cada uma das quatro listagens e observar a nova linha entrando com transição visível, terminando alinhada às demais. Entregável e demonstrável sem depender da animação de saída.

**Acceptance Scenarios**:

1. **Given** a listagem de capítulos na página de detalhe do livro, **When** o operador confirma a criação de um novo capítulo, **Then** a nova linha entra com transição visível e permanece na posição final.
2. **Given** a listagem de narradores (idem editores e estúdios), **When** o operador confirma a criação inline, **Then** a nova linha entra com a mesma transição.
3. **Given** a preferência de movimento reduzido ativa, **When** um item é criado, **Then** a linha aparece instantaneamente, sem animação.

---

### User Story 2 - Saída animada ao remover uma linha (Priority: P2)

Ao remover um item de qualquer das quatro listagens, a linha correspondente anima sua saída (esmaece e desliza para fora) antes de desaparecer, em vez de sumir abruptamente — dando ao operador um sinal claro de que aquela linha específica foi removida.

**Why this priority**: Reforça o feedback de ação destrutiva (alinhado à preferência do projeto por warning/undo discreto). Depende de manter a linha montada durante a animação antes da remoção efetiva, sendo levemente mais complexo que a entrada — por isso vem depois da P1.

**Independent Test**: Remover um item em cada uma das quatro listagens (incluindo a remoção em massa de capítulos) e observar a linha animando a saída antes de deixar a lista.

**Acceptance Scenarios**:

1. **Given** uma linha existente em qualquer das listagens, **When** o operador remove o item, **Then** a linha anima a saída e só então é retirada da lista.
2. **Given** a remoção em massa de capítulos, **When** múltiplas linhas são removidas, **Then** todas as linhas afetadas animam a saída.
3. **Given** a preferência de movimento reduzido ativa, **When** um item é removido, **Then** a linha some instantaneamente, sem animação.

---

### User Story 3 - Consistência com tema e movimento reduzido (Priority: P3)

O usuário tem uma experiência consistente independentemente da preferência de movimento e do tema: com movimento reduzido nada anima; em tema claro ou escuro as transições aparecem corretas, sem flash de cor inadequada nem perda de contraste.

**Why this priority**: Acessibilidade e consistência visual. É transversal às histórias P1/P2, mas é verificável de forma independente alternando preferências e temas.

**Independent Test**: Alternar `prefers-reduced-motion` e o tema (claro/escuro) e repetir as ações de criar e remover nas quatro listagens, verificando o comportamento esperado em cada combinação.

**Acceptance Scenarios**:

1. **Given** `prefers-reduced-motion: reduce`, **When** um item é criado ou removido em qualquer listagem, **Then** nenhuma animação de entrada/saída ocorre.
2. **Given** o tema escuro, **When** uma linha entra ou sai, **Then** as cores e o contraste permanecem corretos, sem flash de cor inadequada.

---

### Edge Cases

- **Carga inicial da listagem** (navegação ou refresh de dados): as linhas já existentes **não** animam todas de uma vez; apenas linhas que entram ou saem como resultado de uma ação do usuário animam.
- **Reordenação de itens** (capítulos, quando aplicável): mover uma linha de posição **não** dispara animação de entrada/saída — uma linha reposicionada não está entrando nem deixando a lista (a animação de reordenação pertence à Fase B).
- **Desarquive por colisão de nome** (estúdio/narrador/editor): quando a reativação de um registro arquivado faz uma linha reaparecer na listagem, isso conta como uma entrada e anima como tal.
- **Criar e remover em sequência rápida**: o sistema permanece consistente; uma remoção iniciada durante a animação de entrada não deixa a linha presa.
- **Falha de servidor ao criar/remover**: se a operação falhar, a lista reflete o estado real após o erro e nenhuma linha fica presa em estado animado intermediário.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Ao adicionar com sucesso um item a qualquer das quatro listagens (capítulos, narradores, editores, estúdios), a nova linha DEVE entrar com uma transição visível em vez de aparecer instantaneamente.
- **FR-002**: Ao remover um item de qualquer das quatro listagens, a linha correspondente DEVE animar a saída antes de ser retirada da lista.
- **FR-003**: As animações DEVEM respeitar a preferência `prefers-reduced-motion`: quando ativa, adições e remoções são aplicadas instantaneamente, sem animação.
- **FR-004**: As animações DEVEM funcionar corretamente em tema claro e escuro, sem flash de cor inadequada nem perda de contraste.
- **FR-005**: A carga inicial de uma listagem NÃO DEVE animar todas as linhas existentes; apenas linhas que entram ou saem por ação do usuário animam.
- **FR-006**: A reordenação de itens NÃO DEVE disparar animação de entrada/saída; deve permanecer visualmente neutra (a animação de reordenação fica na Fase B).
- **FR-007**: Se a operação de criar ou remover falhar, a UI NÃO DEVE deixar a linha em estado animado inconsistente; a lista DEVE refletir o estado real após o erro.
- **FR-008**: As transições DEVEM ser percebidas como suaves (sem travamento) e curtas o bastante para não atrasar a percepção da ação.
- **FR-009**: O estilo e a duração das transições DEVEM ser consistentes entre as quatro listagens.
- **FR-010**: O comportamento de entrada/saída DEVE valer para todos os caminhos de criação/remoção dessas listagens (criação inline em nova linha, diálogo de adicionar capítulo, ações de remover individuais e remoção em massa de capítulos).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fora de movimento reduzido, 100% das criações de item nas quatro listagens exibem a linha entrando com transição visível.
- **SC-002**: Fora de movimento reduzido, 100% das remoções exibem a linha saindo com transição antes de desaparecer.
- **SC-003**: Com `prefers-reduced-motion` ativo, 0 animações ocorrem — todas as mudanças são instantâneas.
- **SC-004**: Cada transição de entrada/saída conclui em até 300 ms, sem atraso perceptível na efetivação da ação.
- **SC-005**: As animações são visualmente corretas em tema claro e escuro nas quatro listagens, sem regressão visual.
- **SC-006**: Nenhuma regressão funcional: itens continuam sendo criados e removidos e as contagens/estado das listas atualizam corretamente.
- **SC-007**: As transições são percebidas como suaves (sem stutter) em hardware típico de uso.

## Assumptions

- A solução reutiliza os recursos de animação já presentes no produto; **nenhuma dependência externa nova** é adicionada.
- As animações usam apenas propriedades performáticas (transformação e opacidade), evitando recálculo de layout que cause travamento; a largura/altura das linhas não é animada.
- O escopo cobre as quatro listagens em tabela: capítulos (na página de detalhe do livro), narradores, editores e estúdios.
- **Fora de escopo**: transição animada entre páginas (Fase B — ver `futuras-features.md`), animação de reordenação de capítulos (Fase B) e animação de linha em modo de edição (descartado, pois a linha não muda de largura ao entrar/sair de edição).
- A animação integra-se aos fluxos de criação/remoção já existentes, sem alterar contratos de API ou modelo de dados.
- Conforme as convenções do projeto, qualquer estado necessário para a animação (por exemplo, controlar linhas "saindo") reside em hooks co-localizados; os componentes permanecem de renderização.
