# Feature Specification: Agrupamento de capítulos por editor/narrador/status na tabela do livro

**Feature Branch**: `024-chapter-grouping`
**Created**: 2026-05-13
**Status**: Draft
**Input**: User description: "Disponibilizar uma forma do usuário saber a minutagem de cada editor e narrador em um livro. Eu sugiro fazer isso disponibilizando a funcionalidade 'agrupar' já presente no TanStack Table"

## Clarifications

### Session 2026-05-13

- Q: Valor inicial da feature flag `SHOW_EARNINGS_IN_NARRATOR_GROUPS` no v1? → A: `true` — mostrar com label provisória, coletar feedback real
- Q: Como o usuário reordena dimensões já selecionadas no controle? → A: Não há reordenação dedicada — a ordem é definida pela sequência de cliques. Pra reordenar, usuário desmarca e re-marca na ordem desejada
- Q: Como o sort do header da tabela interage com o agrupamento ativo? → A: Sort do header aplica dentro dos grupos (nas folhas); a ordenação dos próprios grupos continua por minutagem decrescente (FR-006)
- Q: Estado de expansão dos grupos sobrevive a re-fetches após mutações? → A: Sim — preservado durante a sessão; só reseta em navegação real (sair e voltar à rota)
- Q: Capítulo criado/editado durante agrupamento ativo auto-expande o grupo afetado? → A: Não — totais atualizam imediatamente, mas expansão permanece como o usuário deixou

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Agrupar capítulos por editor com totais (Priority: P1)

O usuário abre a página de um livro, vê a tabela de capítulos no formato "flat", e ativa o agrupamento por **editor** em um controle dedicado. A tabela colapsa em grupos: cada linha de grupo mostra o nome do editor, quantidade de capítulos atribuídos a ele, soma de segundos editados (formatada como "1h 24min"), ganho total em R$ e breakdown por status. Expandindo um grupo, vê os capítulos ordenados por número.

**Why this priority**: É o caso de uso primário declarado — relatar ao estúdio cliente "quanto cada editor entregou neste livro". Sozinho já fecha o relatório.

**Independent Test**: Acessar `/books/<id>`, abrir o seletor de agrupamento, escolher "Editor". Confirmar que (a) cada editor aparece em uma única linha-resumo; (b) totais batem com a soma manual; (c) capítulos sem editor caem em "Sem atribuição" no fundo; (d) os grupos estão ordenados por minutagem decrescente.

**Acceptance Scenarios**:

1. **Given** um livro com 10 capítulos distribuídos entre 2 editores (Editor A com 6 caps, Editor B com 4 caps) e 2 capítulos sem editor, **When** o usuário seleciona "Editor" no controle de agrupamento, **Then** a tabela mostra 3 grupos colapsados — Editor A (mais minutos no topo), Editor B em seguida, "Sem atribuição" no fim — cada um com qtd de capítulos, total de tempo formatado, ganho em R$ e breakdown por status.
2. **Given** o agrupamento por editor ativo, **When** o usuário clica para expandir o grupo "Editor A", **Then** os 6 capítulos aparecem ordenados por número do capítulo ascendente.
3. **Given** o agrupamento ativo, **When** o usuário copia a URL e abre em outra aba, **Then** a nova aba carrega já com o agrupamento por editor aplicado.
4. **Given** o agrupamento ativo, **When** o usuário escolhe "Sem agrupamento" no controle, **Then** a tabela volta ao formato flat e o search param da URL é removido.

---

### User Story 2 — Agrupar por narrador com totais (Priority: P1)

Mesma experiência da Story 1, mas a dimensão é **narrador**. Importante: minutagem aqui ainda é `edited_seconds` (áudio final editado, não duração crua de gravação), porque essa é a métrica reportável ao cliente.

**Why this priority**: É a segunda metade explícita do pedido. Empatado com editor em prioridade — ambos compõem o relatório que motiva a feature.

**Independent Test**: Acessar `/books/<id>`, escolher "Narrador" no agrupamento, verificar agregação correta por `narrator_id` e bucket "Sem atribuição" para capítulos sem narrador (tipicamente status `pending`).

**Acceptance Scenarios**:

1. **Given** um livro com 8 capítulos divididos entre 3 narradores e 1 capítulo em `pending` sem narrador, **When** o usuário agrupa por "Narrador", **Then** vê 4 grupos: os 3 narradores ordenados por minutagem decrescente + "Sem atribuição" no fundo.
2. **Given** um capítulo cujo `edited_seconds = 0` (ainda em edição), **When** ele é contado em um grupo, **Then** ele incrementa a contagem de capítulos do grupo mas contribui 0 à soma de tempo e 0 ao ganho.

---

### User Story 3 — Agrupar por status (Priority: P2)

O usuário agrupa a tabela por **status** do capítulo (pending, editing, reviewing, retake, completed, paid) para ter uma visão operacional: "quanto de áudio do livro já está concluído? quanto ainda está em revisão?".

**Why this priority**: Não é o caso de uso primário (relatório ao cliente), mas é uma visão operacional natural e barata, já que a dimensão é uma terceira coluna existente. Cabe num MVP enxuto.

**Independent Test**: Agrupar por "Status", confirmar que cada status presente no livro vira um grupo, ordenado por minutagem decrescente.

**Acceptance Scenarios**:

1. **Given** um livro com capítulos em 4 status diferentes, **When** o usuário agrupa por "Status", **Then** vê 4 grupos com rótulos em português (ex: "Em revisão", "Concluído").
2. **Given** o agrupamento por status, **When** olhando a linha-resumo, **Then** o breakdown por status na coluna agregada é redundante e DEVE ser substituído por apenas a contagem total, evitando informação duplicada.

---

### User Story 4 — Agrupamento multi-nível (Priority: P2)

O usuário escolhe múltiplas dimensões em ordem (ex: Narrador → Editor → Status) e a tabela mostra hierarquia colapsável: dentro de cada narrador, sub-grupos por editor; dentro de cada editor, sub-grupos por status. Totais agregam corretamente em cada nível.

**Why this priority**: Enriquece o relatório quando o cliente quer cruzar dimensões ("o Narrador X foi editado por quem, e em que estado está?"). Não bloqueia o MVP do P1.

**Independent Test**: Ativar agrupamento `Narrador → Editor`, verificar que cada narrador tem sub-grupos por editor e que as somas dos sub-grupos batem com o total do nível superior.

**Acceptance Scenarios**:

1. **Given** o controle de agrupamento, **When** o usuário clica em "Narrador" e em seguida em "Editor", **Then** a URL reflete a ordem dos cliques (`?groupBy=narrator,editor`) e a tabela mostra hierarquia de 2 níveis com narrador no nível externo.
2. **Given** o agrupamento `Narrador → Editor` ativo, **When** o usuário quer trocar para `Editor → Narrador`, **Then** ele desmarca ambas as dimensões e clica primeiro em "Editor" depois em "Narrador" — não há controle dedicado de reordenação.
3. **Given** Narrador → Editor ativo, **When** o usuário soma manualmente os totais dos sub-grupos "Editor" sob "Narrador A", **Then** o total bate com a linha-resumo do nível "Narrador A".

---

### User Story 5 — Feature flag do ganho em R$ no agrupamento por narrador (Priority: P3)

O ganho em R$ no domínio é pago ao editor, não ao narrador. Quando agrupado por narrador, exibir "ganho" pode ser confuso ("é o que o narrador recebe? não — é o que os editores receberam editando o material dele"). Para validar a melhor label antes de decidir, a coluna é controlada por uma feature flag de código.

**Why this priority**: Polimento/experimentação. Não bloqueia funcionalidade; serve para iteração de UX após observação real.

**Independent Test**: Alterar a constante da flag, recarregar a página, confirmar que a coluna de ganho some das linhas-resumo de grupos por narrador (e somente desses) sem afetar agrupamentos por editor ou status.

**Acceptance Scenarios**:

1. **Given** a flag `SHOW_EARNINGS_IN_NARRATOR_GROUPS = false`, **When** o usuário agrupa por narrador, **Then** a coluna "Ganho" não aparece nas linhas-resumo de narrador; ao expandir, capítulos individuais continuam mostrando ganho normalmente.
2. **Given** a flag `SHOW_EARNINGS_IN_NARRATOR_GROUPS = true`, **When** o usuário agrupa por narrador, **Then** a coluna "Ganho" aparece com a soma agregada.
3. **Given** agrupamento multi-nível `Narrador → Editor` com a flag `false`, **When** olhando linha de narrador, **Then** ganho não aparece nessa linha; ao expandir para os editores, linhas-resumo de editor mostram ganho normalmente.

---

### Edge Cases

- **Livro sem capítulos**: o controle de agrupamento fica disponível, mas a tabela mostra estado vazio independente da seleção.
- **Todos os capítulos sem atribuição** (livro recém-criado): único grupo "Sem atribuição" aparece (e é o único do total).
- **Search param inválido** (ex: `?groupBy=foo` ou `?groupBy=editor,editor`): ignora o valor, mostra tabela flat sem erro visível ao usuário, e remove o param da URL.
- **Dimensão repetida no controle**: o controle DEVE impedir o usuário de adicionar a mesma dimensão duas vezes na hierarquia.
- **Capítulo `pending` ou `editing` (edited_seconds = 0)**: incrementa contagem do grupo mas contribui 0 à minutagem e ao ganho.
- **Capítulo `paid`**: continua agregando normalmente; o status `paid` apenas trava edição financeira, não a agregação.
- **Ordenação interna em grupos de status quando agrupado por status**: capítulos dentro do grupo continuam ordenados por número do capítulo.
- **Breakdown por status na linha-resumo quando a dimensão de agrupamento é "status"**: substituir por contagem simples (evitar redundância visual).
- **Performance com livro de muitos capítulos**: agrupamento é client-side via TanStack Table; com a frota atual (livros típicos < 500 capítulos) não há agregação no banco. Documentado como assumption.
- **Mudança de agrupamento durante operação aberta**: trocar agrupamento NÃO deve afetar mutações em andamento (ex: dialog de edição aberto continua válido).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A tabela de capítulos em `/books/<id>` DEVE expor um controle de agrupamento permitindo selecionar zero ou mais dimensões dentre `editor`, `narrador`, `status`, em ordem definida pelo usuário. Zero dimensões selecionadas = tabela flat (comportamento atual).
- **FR-002**: O estado do agrupamento DEVE ser persistido na URL como search param ordenado (ex: `?groupBy=narrator,editor`). Carregar a URL com o param já aplica o agrupamento.
- **FR-003**: Search param de agrupamento com valores inválidos, duplicados ou desconhecidos DEVE ser silenciosamente descartado; a página renderiza a tabela flat e o param é removido da URL.
- **FR-004**: Capítulos sem valor para a dimensão de agrupamento (ex: `narrator_id IS NULL` quando agrupado por narrador) DEVEM ser agrupados em um bucket único rotulado "Sem atribuição", exibido sempre como último grupo do seu nível independentemente da minutagem.
- **FR-005**: A linha-resumo de cada grupo DEVE exibir, na ordem: rótulo do grupo (nome do editor / nome do narrador / rótulo PT-BR do status / "Sem atribuição"), número de capítulos do grupo, soma de `edited_seconds` formatada conforme regras abaixo, ganho total em BRL formatado (`R$ X,XX`), e breakdown por status (ex: "3 concluídos · 1 em revisão").
  - **Formato de tempo** (soma de `edited_seconds`):
    - Soma `= 0` → `"0min"`.
    - `hours = 0` e `minutes > 0` → `"Ymin"` (ex: `"23min"`).
    - `hours > 0` e `minutes = 0` → `"Xh"` (ex: `"3h"`).
    - `hours > 0` e `minutes > 0` → `"Xh Ymin"` (ex: `"1h 24min"`).
- **FR-006**: Grupos do mesmo nível DEVEM ser ordenados por soma de `edited_seconds` em ordem decrescente. O bucket "Sem atribuição" é sempre o último do nível, independentemente do valor.
- **FR-007**: Capítulos dentro de um grupo (folhas da hierarquia) DEVEM ser ordenados por número do capítulo ascendente por padrão. Quando o usuário clica em um header de coluna para ordenar, essa ordenação aplica-se **apenas dentro dos grupos** (folhas); a ordenação dos próprios grupos (FR-006) NÃO é afetada e continua sendo por soma de `edited_seconds` decrescente.
- **FR-008**: Ao carregar a página, todos os grupos DEVEM iniciar colapsados. O estado de expansão é mantido **em memória do componente durante a sessão** — sobrevive a re-fetches dos capítulos disparados por mutações (ex: criar/editar/atribuir/deletar capítulo, marcar como pago). O estado NÃO é persistido entre navegações reais (sair da rota e voltar reseta para todos colapsados) nem na URL.
- **FR-009**: A "minutagem" de qualquer grupo é definida como a soma de `chapter.edited_seconds` dos capítulos contidos (em todas as profundidades). Capítulos com `edited_seconds = 0` (status `pending` / `editing`) contribuem 0 à soma mas contam para a quantidade de capítulos do grupo.
- **FR-010**: O ganho em R$ de um grupo é definido como `sum(round(chapter.edited_seconds × book.price_per_hour_cents / 3600))` em centavos, dividido por 100 e formatado em BRL. A fórmula por capítulo é a mesma já definida pelo domínio (centavos, half-away-from-zero, conversão só na apresentação).
- **FR-011**: A coluna de ganho em R$ na linha-resumo dos grupos de **narrador** DEVE ser controlada por uma feature flag (`SHOW_EARNINGS_IN_NARRATOR_GROUPS`) definida como constante de código (em arquivo de configuração compartilhado). Quando `false`, a coluna some apenas das linhas-resumo cuja dimensão de agrupamento é narrador; quando `true`, aparece normalmente. Capítulos individuais (folhas) e linhas-resumo de outras dimensões NÃO são afetados pela flag. **Valor inicial no v1: `true`** — a coluna aparece por padrão com label provisória; o valor pode ser alternado em PR posterior baseado em feedback real.
- **FR-012**: Mudar o agrupamento via controle DEVE atualizar a URL (cf. FR-002 para o formato) sem disparar recarga de página nem perder estado de outros search params. FR-002 trata da persistência/load do estado; FR-012 trata exclusivamente da escrita disparada por interação do usuário.
- **FR-013**: O controle DEVE permitir limpar todas as dimensões em uma única ação ("Sem agrupamento"), removendo o search param da URL.
- **FR-014**: O controle DEVE impedir que a mesma dimensão seja selecionada mais de uma vez na hierarquia. Cada dimensão aparece como item marcável/desmarcável no controle; clicar em uma dimensão já marcada DEVE desmarcá-la (e removê-la da hierarquia).
- **FR-019**: A ordem da hierarquia de agrupamento DEVE ser definida pela sequência de marcação no controle (primeira dimensão marcada vira o nível mais externo, segunda vira o sub-nível, e assim por diante). NÃO há controle dedicado de reordenação no v1 — para mudar a ordem, o usuário desmarca e re-marca as dimensões na sequência desejada.
- **FR-020**: Mutações em capítulos (criar, editar, atribuir narrador/editor, mudar status, deletar) durante agrupamento ativo DEVEM atualizar imediatamente os totais (qtd, minutagem, ganho) e a composição dos grupos. NÃO há auto-expansão do grupo afetado pela mutação — o estado de expansão permanece exatamente como o usuário deixou antes da mutação.
- **FR-015**: O breakdown por status na linha-resumo DEVE usar os rótulos PT-BR já definidos pelo domínio (Pendente, Em edição, Em revisão, Retake, Concluído, Pago). Quando a dimensão de agrupamento é "status" e a linha-resumo já representa um único status, o breakdown DEVE ser substituído pela contagem total simples (sem redundância).
- **FR-016**: O controle de agrupamento DEVE ser acessível por teclado e seguir as convenções de componentes shadcn/ui já adotadas no projeto. Funciona em modo claro e escuro.
- **FR-017**: A apresentação deve seguir a constituição do projeto: lógica de derivação dos totais e do estado de agrupamento vive em hook customizado em `src/components/features/<feature>/hooks/`; o componente client apenas renderiza JSX e chama o hook.
- **FR-018**: A feature NÃO altera schema de banco, NÃO adiciona rotas `/api/v1/**`, NÃO faz fetch adicional. Toda agregação é derivada client-side da resposta atual do endpoint que lista capítulos do livro.

### Key Entities

- **Capítulo**: já existente. Relevante: `id`, `chapter_number`, `book_id`, `narrator_id`, `editor_id`, `status`, `edited_seconds`. Usado como folha do agrupamento.
- **Livro**: já existente. Relevante: `id`, `price_per_hour_cents` (entra na fórmula de ganho), lista de capítulos.
- **Editor / Narrador**: já existentes. Usados como dimensão de grupo. `name` aparece como rótulo de grupo.
- **Status**: enum já existente (`pending`, `editing`, `reviewing`, `retake`, `completed`, `paid`). Usado como dimensão e como breakdown.
- **Estado de agrupamento** (frontend, sem persistência): array ordenado de dimensões serializado na URL. Não é entidade de domínio nem persiste no banco.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em um livro com 30 capítulos, o usuário consegue gerar o relatório "quantas horas cada editor entregou" em **menos de 10 segundos** desde o carregamento da página (abrir, abrir o seletor, escolher editor, ler totais).
- **SC-002**: Link compartilhado com `?groupBy=...` carrega na página de destino com o agrupamento aplicado em **menos de 2 segundos** após o load inicial da rota (sem requisição extra além das já feitas pelo carregamento normal da página).
- **SC-003**: Para **100% dos casos**, os totais (qtd de capítulos, soma de `edited_seconds`, ganho em R$) exibidos em uma linha-resumo são idênticos à soma manual dos capítulos individuais do grupo.
- **SC-004**: Para **100% dos casos**, capítulos sem valor na dimensão de agrupamento aparecem exatamente uma vez, dentro do bucket "Sem atribuição", e esse bucket é sempre o último do seu nível.
- **SC-005**: Em um livro com até 500 capítulos, trocar o agrupamento (selecionar/limpar dimensões) atualiza a tabela em **menos de 300 ms** percebidos pelo usuário, sem trigger de fetch ao servidor.
- **SC-006**: A feature flag de ganho-no-agrupamento-por-narrador pode ser alternada (mudar constante + reload do dev server) e o efeito é observado em **menos de 30 segundos**, sem necessidade de migração, mudança de schema ou rebuild de produção.

## Assumptions

- A tabela de capítulos em `/books/<id>` já usa TanStack Table e expõe colunas para editor, narrador, status, `edited_seconds` e ganho derivado — agrupamento será adicionado sobre a estrutura existente, sem reescrever a tabela.
- O endpoint atual que lista capítulos do livro retorna todos os capítulos do livro em uma única resposta (sem paginação client-side); a agregação roda local sobre essa lista. Caso futuramente exista paginação, o agrupamento precisará migrar para agregação server-side — fora do escopo desta versão.
- Livros típicos têm menos de **500 capítulos**; agregação client-side via TanStack Table é suficiente. Não há requisito de pré-cálculo no banco.
- O relatório destinado ao estúdio cliente será consumido visualmente (screenshot, print, ou compartilhamento de link). Exportação CSV/PDF e impressão estilizada NÃO entram nesta feature.
- A feature flag vive como constante em arquivo de configuração compartilhado do projeto (caminho exato a definir no plan). NÃO é flag por usuário, NÃO usa serviço externo (GrowthBook etc.), NÃO é env var.
- A label específica usada na coluna de ganho quando agrupado por narrador (ex: "Ganho", "Pago aos editores", "Custo de edição") será decidida durante a iteração com a flag ligada; não faz parte do critério de aceite inicial.
- Mudar agrupamento NÃO afeta outras funcionalidades operacionais da página de livro (criar/editar/deletar capítulo, atribuir narrador/editor, marcar como pago). Essas continuam funcionais durante qualquer estado de agrupamento.
- Acessibilidade do controle segue o padrão dos componentes shadcn/ui já adotados; não há requisito de acessibilidade adicional além do baseline do projeto.
- Esta feature NÃO requer mudança no endpoint atual nem na camada de persistência; é puramente apresentacional.
