# Feature Specification: CRUD de Livros e Capítulos

**Feature Branch**: `020-books-chapters-crud`
**Created**: 2026-04-23
**Status**: Clarified (11 pontos resolvidos em 2026-04-23)
**Input**: User description: "CRUD de Livros e Capítulos — listagem em /books, modal de criação com criação inline de estúdio, tela de detalhes (Node ID: YeFYS) com cabeçalho, listagem de capítulos, edição/exclusão de livro, aumento/exclusão de capítulos, modo de exclusão em lote, PDF do livro via tooltip. Inclui constraints de exclusão para estúdio/narrador/editor vinculados a livros ativos e colunas derivadas (Livros em /studios, Capítulos em /narrators e /editors). Separar cada tabela em um arquivo de schema."

## Clarifications

### Session 2026-04-23

- Q: Como o "status do livro" exibido na listagem `/books` e no cabeçalho de `/books/:id` é determinado a partir dos capítulos? → A: **Opção C** — campo explícito `book.status` **persistido** no livro e **atualizado automaticamente** pela camada de service (não por trigger de banco) sempre que uma operação altera o estado de um capítulo do livro. A atualização ocorre **na mesma transação** da mutação do capítulo (ex: mudança de status, criação, exclusão em lote, exclusão individual), garantindo consistência atômica. Regra de cálculo: `pago` se todos os capítulos são `pago`; `concluído` se todos são `concluído`/`pago` com ≥ 1 `concluído`; `em revisão` se ≥ 1 em `em revisão`/`edição retake`; `em edição` se ≥ 1 em `em edição`; `pendente` caso contrário. Essa decisão **introduz redundância controlada** (o status é derivável dos capítulos, mas materializado no livro) em troca de performance de leitura previsível (uma única coluna lida em listagem em vez de agregação condicional sobre todos os capítulos). O risco de desalinhamento com o Princípio I (capítulo é a unidade central) é mitigado por: (i) o status **nunca** é editável diretamente pelo produtor — é sempre derivado; (ii) a recomputação é centralizada em um único helper no service layer invocado por todos os pontos de mutação; (iii) um teste de integração valida a consistência (`book.status` sempre igual à derivação dos capítulos) e um check-only script em `bun run` pode ser executado para auditar divergências. Capítulo permanece a fonte operacional da verdade; `book.status` é apenas um **cache materializado** dessa derivação.
- Q: O que acontece com livros históricos (todos capítulos em `concluído`/`pago`) quando o estúdio dono deles é excluído? → A: **Opção C — Soft-delete do estúdio**. A tabela `studio` ganha uma coluna `deleted_at timestamp nullable`. "Excluir estúdio" em `/studios` passa a marcar `deleted_at = now()` (nunca apaga a linha fisicamente). Estúdios com `deleted_at IS NOT NULL`: (i) NÃO aparecem na listagem `/studios`; (ii) NÃO aparecem no seletor de estúdio do modal de criação/edição de livro; (iii) NÃO são contados na coluna "Livros" da listagem `/studios` (porque a linha não está visível); (iv) **continuam resolvendo** a FK `book.studio_id` para exibir o nome do estúdio no detalhe/listagem de livros históricos. A regra de FR-046 continua valendo como pré-condição do soft-delete: se existe pelo menos 1 livro com ≥ 1 capítulo em status ativo, o soft-delete é bloqueado com `409 STUDIO_HAS_ACTIVE_BOOKS`. Quando o soft-delete é aceito, o `book.price_per_hour` e capítulos `pago` permanecem intactos (Princípio II preservado — imutabilidade financeira) e o histórico segue auditável. Um estúdio soft-deleted pode ser **reativado** somente via operação explícita em banco (fora de escopo desta feature); não há UX de "desarquivar" no MVP. O `studio.name` continua sob constraint único **incluindo** soft-deleted — ou seja, o nome não pode ser reutilizado enquanto o estúdio existir na tabela (para preservar auditabilidade de nomes históricos). Esta decisão se aplica **apenas a Estúdio** nesta feature; Narrador e Editor seguem a mesma semântica definida na Q3.
- Q: Quando o produtor cria um estúdio inline dentro do modal de livro, qual valor usar para `default_hourly_rate` e como propagar o valor do livro? → A: O estúdio é persistido **imediatamente** com `default_hourly_rate = R$ 0,01` (mínimo placeholder), independentemente do estado do campo "Valor/hora do livro" (isso respeita a ordem natural de preenchimento: estúdio antes do valor/hora). Quando o livro é criado com sucesso, o service — na **mesma transação** — propaga `book.price_per_hour` para o `default_hourly_rate` do estúdio recém-criado. A propagação aplica-se **apenas a estúdios criados inline nesta sessão do modal** (identificados por flag/id explícito no payload); estúdios pré-existentes selecionados mantêm seu `default_hourly_rate` inalterado. Se o produtor cancela o modal sem criar o livro, o estúdio permanece com R$ 0,01 e um toast de atenção alerta: "O estúdio '<nome>' foi criado com valor/hora padrão muito baixo (R$ 0,01). Ajuste em `/studios` antes de usá-lo em outro livro."
- Q: Ao excluir narrador/editor vinculado apenas a capítulos de livros 100% concluídos/pagos, o histórico é preservado? → A: **Opção A — Soft-delete** de narrador e editor, simétrico à Q2.
- Q: Livro pode existir sem capítulos? → A: **Não**. A invariante é absoluta: um livro sempre tem ≥ 1 capítulo. Remover o cenário US4.4 (livro com 0 capítulos). O empty state de "tela de detalhes sem capítulos" não existe como caso válido — se essa situação ocorresse, seria bug e deveria ser tratada como inconsistência de dados.
- Q: Quais colunas do capítulo são editáveis inline? → A: Exatamente **quatro**: Narrador, Editor, Status e Horas editadas (horas gravadas). O campo `num_paginas` **não existe** no modelo de domínio — deve ser removido de todos os pontos da spec (US, FRs, Key Entities, tabela). O número do capítulo (`numero`) permanece imutável.
- Q: Capítulo em status `pago` pode ter seu status revertido? → A: **Sim, com confirmação explícita**. O status é o único campo que pode sair do estado `pago` — todos os outros (narrador, editor, horas, e `price_per_hour` do livro) permanecem bloqueados enquanto existir ≥ 1 capítulo `pago`. Reverter `pago → outro status` exige um **modal de alerta** com mensagem clara sobre o impacto (auditoria financeira) e confirmação dupla. Transições permitidas a partir de `pago`: somente `pago → concluido` (reversão para revisão aprovada, caso o pagamento tenha sido estornado/errado). Outras reversões (`pago → em_revisao`, `pago → em_edicao`, `pago → pendente`) são **bloqueadas** (forçam o fluxo a passar por `concluido` primeiro).
- Q: No modo de exclusão em lote, os ícones por linha e o botão "Editar livro" são ocultados ou desabilitados? → A: **Ocultados** — não apenas desabilitados. Manter a interface livre de affordances irrelevantes durante o modo de exclusão reduz ambiguidade visual.
- Q: Como expor "desarquivar" estúdio/narrador/editor soft-deleted? → A: **Desarquivar automático por colisão de nome**. Não há toggle "Mostrar arquivados" nem página dedicada no MVP. Quando o produtor tenta criar um estúdio, narrador ou editor com um **nome que colide** com um registro soft-deleted, o sistema **reativa o registro existente** (seta `deleted_at = NULL` na mesma transação) em vez de retornar erro de nome duplicado. A reativação preserva todos os campos originais (ex: `default_hourly_rate` do estúdio, estatísticas históricas do narrador/editor). Um toast informa "Um estúdio/narrador/editor com esse nome foi desarquivado." Uma exceção: quando o desarquive ocorre via criação inline no modal de livro (US3), a regra de "setar `default_hourly_rate = R$ 0,01` + propagar na criação do livro" (FR-012/FR-012a) se aplica e sobrescreve o rate histórico — o produtor é avisado via toast que o rate foi redefinido. Comparação de nome segue o mesmo constraint único já existente (case-insensitive ou byte-exato conforme cada entidade).
- Q: Após inclusão/exclusão de capítulos, `book.status` deve ser recomputado? → A: **Sim, sempre e transacionalmente**. `recomputeBookStatus(bookId, tx)` é invocado **após cada mutação** que altera o conjunto de capítulos ou o status de um capítulo — inclui: criação de livro, criação de N capítulos via "Editar livro", exclusão individual de capítulo, exclusão em lote, mudança de status de capítulo (incluindo reversão de `pago`). Dois cenários foram codificados explicitamente como critérios de aceitação em US5: (i) livro com 2 capítulos (1 `pago` + 1 `pendente`); excluir o `pendente` → `book.status = pago`; (ii) livro com 1 capítulo `pago`; adicionar 1 capítulo novo (status `pendente`) → `book.status = pendente`. As tabelas `narrator` e `editor` ganham coluna `deleted_at timestamp nullable`. "Excluir" nas telas `/narrators` e `/editors` marca `deleted_at = now()` em vez de remover a linha, **desde que** a pré-condição de FR-047/FR-048 seja respeitada (nenhum capítulo em livro com status ativo). Narradores/editores soft-deleted: (i) NÃO aparecem na listagem `/narrators`/`/editors`; (ii) NÃO aparecem nos seletores "Narrador"/"Editor" ao editar um capítulo (ou seja, não podem ser atribuídos a um novo capítulo nem a um já existente); (iii) NÃO são contados na coluna "Capítulos" de `/narrators`/`/editors` (FR-051); (iv) **continuam resolvendo** as FKs `chapter.narrator_id`/`chapter.editor_id` para exibir o nome nas linhas de capítulos históricos (`concluido`/`pago`). Os constraints únicos (`narrator.name`, `editor.name`) são preservados incluindo registros soft-deleted. A regra de bloqueio FR-047/FR-048 (`409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS` / `409 EDITOR_LINKED_TO_ACTIVE_CHAPTERS`) continua valendo como pré-condição do soft-delete. Reativação está fora de escopo desta feature.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listar livros cadastrados (Priority: P1)

O produtor acessa `/books` e visualiza uma tabela com todos os livros cadastrados. A tabela segue o mesmo padrão visual de `/studios`, `/editors` e `/narrators` — inclui barra de pesquisa no topo e botão "+ Novo Livro" — mas **não** possui a coluna "Ações". Cada linha exibe as colunas: "Título", "Estúdio", "Capítulos" (no formato `concluídos/totais`, ex: `3/10`), "Status", "R$/hora" e "Ganho total".

**Why this priority**: Sem a listagem, nenhuma outra operação (criar, abrir detalhes, editar) é possível. É o alicerce de toda a feature.

**Independent Test**: Acessar `/books` e verificar que a tabela renderiza com dados vindos do banco de dados, a barra de pesquisa filtra por título/estúdio e o botão "+ Novo Livro" abre o modal.

**Acceptance Scenarios**:

1. **Given** existem 3 livros cadastrados em estúdios distintos, **When** o produtor acessa `/books`, **Then** a tabela exibe 3 linhas ordenadas por `created_at` DESC (mais recente no topo) com as colunas "Título", "Estúdio", "Capítulos" (`concluídos/totais`), "Status", "R$/hora" (formato BRL) e "Ganho total" (formato BRL).
2. **Given** a tabela exibe um livro com 10 capítulos sendo 3 em status `concluído` ou `pago`, **When** o produtor visualiza a linha, **Then** a coluna "Capítulos" exibe `3/10`.
3. **Given** a tabela está exibida e existe livro "Dom Casmurro", **When** o produtor digita `"Dom"` na barra de pesquisa, **Then** somente o livro cujo título contém `"Dom"` (case-insensitive) permanece visível; digitando o nome de um estúdio, linhas do estúdio correspondente permanecem visíveis.
4. **Given** não existem livros cadastrados, **When** o produtor acessa `/books`, **Then** a tabela exibe um estado vazio com mensagem indicando que não há livros cadastrados e um CTA "+ Novo Livro".
5. **Given** a tabela possui registros, **When** o produtor clica em qualquer linha, **Then** o produtor é navegado para a tela de detalhes desse livro (US4).
6. **Given** a tabela possui registros, **When** o produtor clica no cabeçalho de qualquer coluna ordenável ("Título", "Estúdio", "Capítulos", "R$/hora", "Ganho total"), **Then** a tabela é reordenada por aquela coluna (asc/desc em cliques sucessivos), mantendo o padrão de ordenação já aplicado em `/studios`.
7. **Given** a tabela está renderizada, **When** o produtor inspeciona a linha, **Then** **nenhum ícone** de ação individual (editar/excluir) aparece na linha — a coluna "Ações" está ausente por decisão de produto.

---

### User Story 2 - Criar novo livro via modal (Priority: P1)

O produtor clica em "+ Novo Livro" na página de listagem. Um modal abre com os campos: "Título", "Estúdio" (seletor), "Valor/hora do livro" (BRL cents-first) e "Quantidade de capítulos" (numérico com botões de `-` e `+` além de digitação livre). Ao confirmar, o livro é criado com os N capítulos associados em status `pendente` e o modal fecha; ao cancelar, nada é persistido.

**Why this priority**: Sem criação, não há livros no sistema. Co-fundamental com a listagem.

**Independent Test**: Clicar "+ Novo Livro", preencher todos os campos, confirmar; verificar que o livro aparece na tabela e que N registros de capítulo em status `pendente` foram criados no banco.

**Acceptance Scenarios**:

1. **Given** a página `/books` está exibida, **When** o produtor clica em "+ Novo Livro", **Then** um modal abre contendo os campos "Título" (texto), "Estúdio" (seletor de opções), "Valor/hora" (input monetário em modo cents-first, R$ 0,01–R$ 9.999,99) e "Quantidade de capítulos" (inteiro ≥ 1, com botões `-`/`+` e digitação livre), além de botões "Cancelar" e "Confirmar".
2. **Given** o modal está aberto com todos os campos válidos preenchidos (título, estúdio, valor/hora ≥ R$ 0,01, quantidade ≥ 1), **When** o produtor clica em "Confirmar", **Then** o livro é criado no banco, N registros de capítulo em status `pendente` (numerados de 1 a N) são criados atomicamente, o modal fecha, um toast de sucesso é exibido e a linha do novo livro aparece no topo da tabela com "Capítulos" = `0/N` e "Status" inicial correspondente.
3. **Given** o modal está aberto com campos parcialmente preenchidos, **When** o produtor clica em "Cancelar" ou no botão de fechar, **Then** o modal fecha sem persistir qualquer dado (livro, capítulos); o estúdio criado inline dentro do modal segue regra específica de US3.
4. **Given** o modal está aberto, **When** o produtor tenta confirmar com "Título" vazio (após `trim`), **Then** uma mensagem de validação é exibida indicando que o título é obrigatório e o modal não fecha.
5. **Given** o modal está aberto, **When** o produtor tenta confirmar sem selecionar "Estúdio", **Then** uma mensagem de validação é exibida indicando que o estúdio é obrigatório.
6. **Given** o modal está aberto, **When** o produtor tenta confirmar com "Valor/hora" em `R$ 0,00` ou acima de `R$ 9.999,99`, **Then** uma mensagem de validação é exibida indicando que o valor precisa estar entre R$ 0,01 e R$ 9.999,99.
7. **Given** o modal está aberto, **When** o produtor interage com "Quantidade de capítulos", **Then** o botão `-` decrementa (mínimo = 1, nunca abaixo), o botão `+` incrementa (máximo = 999), e a digitação livre aceita somente dígitos; valores fora da faixa [1, 999] resultam em validação antes da confirmação.
8. **Given** o modal está aberto e já existe um livro "Dom Casmurro" no estúdio "Sonora Studio", **When** o produtor tenta criar outro livro com título "Dom Casmurro" no **mesmo estúdio** (case-insensitive após `trim`), **Then** a criação falha com `409 TITLE_ALREADY_IN_USE` e a mensagem "Já existe um livro com esse título neste estúdio" é exibida abaixo do campo "Título".
9. **Given** o modal está aberto e existe livro "Dom Casmurro" no estúdio A, **When** o produtor cria outro livro "Dom Casmurro" no estúdio B, **Then** a criação é aceita (unicidade é por estúdio, não global).

---

### User Story 3 - Criar estúdio novo sem sair do modal de livro (Priority: P2)

Dentro do modal de criação de livro, ao abrir o seletor de "Estúdio", o produtor vê a lista de estúdios existentes (cada linha exibindo o nome e o "Valor/hora padrão" daquele estúdio) e uma opção "+ Novo Estúdio". Ao selecionar "+ Novo Estúdio", um subformulário compacto aparece permitindo cadastrar um estúdio (somente nome). Ao confirmar o subformulário, o estúdio é criado **imediatamente no banco** com `default_hourly_rate = R$ 0,01` (valor mínimo, placeholder) e passa a ser o estúdio selecionado para o livro em criação. Quando o livro é finalmente criado com sucesso, o service **propaga** o `book.price_per_hour` escolhido para o `default_hourly_rate` do estúdio recém-criado (na mesma transação). Se o produtor cancelar o modal do livro antes de criá-lo, o estúdio permanece no banco com `default_hourly_rate = R$ 0,01` e um toast de atenção alerta que o estúdio ficou com valor padrão muito baixo.

**Why this priority**: Reduz fricção quando o produtor está cadastrando um livro de um estúdio novo. Depende de US2 mas acelera o fluxo principal. A estratégia de criar o estúdio com valor mínimo + propagar depois permite que o produtor preencha os campos do modal na ordem natural (estúdio antes do valor/hora).

**Independent Test**: Abrir modal de novo livro, clicar em "+ Novo Estúdio" no seletor, preencher nome, confirmar subformulário (estúdio já é persistido com `default_hourly_rate = R$ 0,01`), preencher "Valor/hora do livro" = `R$ 75,00` e "Quantidade de capítulos" e confirmar o livro; verificar que o livro foi criado E que o estúdio recém-criado teve seu `default_hourly_rate` atualizado para `R$ 75,00` na mesma transação.

**Acceptance Scenarios**:

1. **Given** o modal de criação de livro está aberto e o produtor ainda não selecionou estúdio, **When** o produtor abre o seletor "Estúdio", **Then** a lista exibe todos os estúdios existentes (nome + "R$/hora padrão" em formato BRL) e uma opção destacada "+ Novo Estúdio".
2. **Given** o seletor de estúdio está aberto, **When** o produtor clica em "+ Novo Estúdio", **Then** um subformulário compacto substitui a lista, com campo "Nome" (obrigatório) e botões "Cancelar" (volta para a lista) e "Criar" (confirma o subformulário).
3. **Given** o subformulário de novo estúdio está exibido, **When** o produtor preenche "Nome" = "Nova Voz Studio" e clica em "Criar", **Then** um estúdio "Nova Voz Studio" é persistido **imediatamente** no banco com `default_hourly_rate = R$ 0,01` (valor mínimo placeholder, independentemente do que esteja no campo "Valor/hora do livro"), o subformulário fecha, o seletor passa a exibir "Nova Voz Studio" como selecionado, e o fluxo de criação de livro prossegue. A criação **não depende** de o campo "Valor/hora do livro" estar preenchido.
4. **Given** o subformulário está visível, **When** o produtor tenta criar com nome vazio ou duplicado (conflito contra `studio.name_unique`), **Then** uma validação é exibida (`"Nome obrigatório"` ou `"Nome já cadastrado"`, respectivamente) e o estúdio não é criado.
5. **Given** o produtor criou inline o estúdio "Nova Voz Studio" (persistido com `default_hourly_rate = R$ 0,01`), preencheu "Valor/hora do livro" = `R$ 75,00` e "Quantidade de capítulos" = 5 e clicou em "Confirmar" no modal do livro, **When** o servidor processa a criação, **Then** em uma **única transação**: (a) o livro é criado com `price_per_hour = R$ 75,00`; (b) os 5 capítulos em `pendente` são criados; (c) o `default_hourly_rate` do estúdio "Nova Voz Studio" é **atualizado** para `R$ 75,00` (propagação do valor do livro); (d) um toast de sucesso é exibido. Se qualquer etapa falhar, toda a transação é revertida (exceto o estúdio previamente persistido em (3) — esse permanece).
6. **Given** o produtor criou inline o estúdio "Nova Voz Studio" (persistido com `default_hourly_rate = R$ 0,01`) e em seguida clicou em "Cancelar" no modal de criação de livro (sem criar o livro), **When** o modal fecha, **Then** o estúdio **permanece criado** com `default_hourly_rate = R$ 0,01` e um toast de atenção é exibido: "O estúdio 'Nova Voz Studio' foi criado com valor/hora padrão muito baixo (R$ 0,01). Ajuste em `/studios` antes de usá-lo em outro livro." Nenhum livro é persistido.
7. **Given** o produtor abriu o subformulário de novo estúdio mas ainda não confirmou a criação do estúdio, **When** ele clica em "Cancelar" do subformulário, **Then** nenhum estúdio é criado (o estúdio só é persistido após o "Criar" do subformulário — cenário (3)).
8. **Given** o produtor fechou o modal do livro (via ESC, clique fora, ou botão fechar) **enquanto o subformulário de novo estúdio ainda está aberto e não foi confirmado**, **Then** nenhum estúdio é criado.

---

### User Story 4 - Acessar detalhes do livro e listagem de capítulos (Priority: P1)

O produtor clica em uma linha da listagem de livros. Abre a tela de detalhes do livro (Node ID: YeFYS) com um cabeçalho contendo: título, estúdio, R$/hora, capítulos concluídos/totais, ganho total, status do livro, botão "Ver PDF", botão "Editar livro" e botão "Excluir capítulos" (ativa modo de exclusão em lote). Abaixo do cabeçalho, a listagem dos capítulos do livro é exibida em tabela. Um botão/link "Voltar" retorna à listagem.

**Why this priority**: A tela de detalhes é onde toda a operação diária sobre capítulos acontece (edição de status, narrador, editor, horas). É co-essencial com a listagem.

**Independent Test**: Clicar em uma linha da tabela `/books`; verificar navegação para `/books/:id`, validar cabeçalho com dados corretos e tabela listando os N capítulos do livro.

**Acceptance Scenarios**:

1. **Given** um livro "Dom Casmurro" do estúdio "Sonora Studio" com 10 capítulos (3 concluídos, 2 pagos, 5 pendentes) e R$/hora = R$ 75,00, **When** o produtor clica na linha desse livro em `/books`, **Then** é navegado para a tela de detalhes, e o cabeçalho exibe: título "Dom Casmurro", estúdio "Sonora Studio", R$/hora "R$ 75,00", capítulos "5/10", ganho total (soma de `horas_editadas × preço_por_hora` de capítulos com horas registradas, formato BRL), status derivado do livro (ver Assumptions), botões "Ver PDF", "Editar livro" e "Excluir capítulos".
2. **Given** a tela de detalhes está aberta, **When** o produtor visualiza a listagem de capítulos, **Then** a tabela exibe uma linha por capítulo com as colunas: número do capítulo, status (badge), narrador, editor, horas editadas, e (para cada linha) ícones de "Editar" e "Excluir" (padrão das outras telas).
3. **Given** a tela de detalhes está aberta, **When** o produtor clica em "Voltar", **Then** retorna para a listagem `/books` preservando o estado de busca/ordenação anterior quando possível.
4. **Given** a URL de detalhes aponta para um `id` inexistente, **When** o produtor acessa, **Then** a página retorna 404 utilizando a `not-found.tsx` global. O caso "livro com 0 capítulos" NÃO existe: a invariante de domínio garante que todo livro persistido tem ≥ 1 capítulo.

---

### User Story 5 - Editar um capítulo individualmente (Priority: P1)

Na tela de detalhes do livro, cada linha de capítulo segue o padrão de `/studios`, `/editors`, `/narrators`: ícones "Editar" e "Excluir". Ao clicar em "Editar", exatamente **quatro** campos ficam editáveis: **Narrador**, **Editor**, **Status** (select limitado às transições válidas da máquina de estados) e **Horas editadas** (numeric). O número do capítulo é imutável. Confirmar persiste; cancelar restaura.

**Why this priority**: Edição de capítulo é a atividade diária mais frequente — registrar progresso, atribuir narrador/editor, registrar horas. Essencial ao MVP.

**Independent Test**: Entrar em uma linha de capítulo, alterar status/narrador/editor/horas e confirmar; verificar que os valores persistem, que `book.status` é recomputado e que transições inválidas são bloqueadas.

**Acceptance Scenarios**:

1. **Given** um capítulo em status `pendente` sem narrador atribuído, **When** o produtor clica em "Editar" e seleciona narrador X e status = `em edição`, **Then** a confirmação é aceita — o capítulo passa a `em edição` com narrador X atribuído e `book.status` é recomputado.
2. **Given** um capítulo em status `pendente` sem narrador atribuído, **When** o produtor tenta mover o status diretamente para `em edição` **sem** selecionar um narrador na mesma edição, **Then** a validação impede a confirmação e exibe "Selecione um narrador para iniciar a edição".
3. **Given** um capítulo em status `em edição`, **When** o produtor edita e tenta mover para `em revisão` **sem** preencher editor e horas editadas, **Then** a validação impede a confirmação e exibe "Editor e horas editadas são obrigatórios para enviar para revisão".
4. **Given** um capítulo em status `em revisão`, **When** o produtor edita e altera o status para `edição retake`, **Then** a transição é aceita (equivale a reprovação na revisão).
5. **Given** um capítulo em status `edição retake`, **When** o produtor altera o status para `em revisão`, **Then** a transição é aceita (retorna à revisão).
6. **Given** um capítulo em status `em revisão`, **When** o produtor altera o status para `concluído`, **Then** a transição é aceita (revisão aprovada).
7. **Given** um capítulo em status `pago`, **When** o produtor clica em "Editar", **Then** os campos **Narrador**, **Editor** e **Horas editadas** estão desabilitados/somente leitura; o campo **Status** permite apenas a transição `pago → concluído` (demais opções ficam desabilitadas); um indicador visual "Pago — dados bloqueados (apenas reversão de status permitida)" é exibido.
8. **Given** um capítulo em status `pago`, **When** o produtor altera o status para `concluído` e clica em "Confirmar", **Then** um **modal de alerta** é exibido com mensagem "⚠ Reverter status de 'Pago' para 'Concluído'. Essa ação afeta a auditoria financeira. Deseja continuar?" e botões "Cancelar" e "Confirmar reversão". Ao confirmar, o status do capítulo passa a `concluído`, `book.status` é recomputado (pode destravar a edição de `price_per_hour` do livro se nenhum outro capítulo estiver `pago`) e a linha volta a ser totalmente editável.
9. **Given** um capítulo em status `concluído`, **When** o produtor altera o status para `pago`, **Then** a transição é aceita e, a partir desse momento, a linha fica parcialmente imutável (exceto a reversão via cenário 8).
10. **Given** um capítulo em qualquer status, **When** o produtor tenta uma transição inválida (ex: pular etapas, `pago → pendente`, `pago → em_revisao`, `concluído → em_edicao`), **Then** a validação impede a confirmação e exibe a razão ("Transição inválida: X → Y não é permitido").
11. **Given** a linha do capítulo está em modo de edição, **When** o produtor clica em "Cancelar", **Then** todos os valores originais são restaurados e a linha volta ao modo de visualização.
12. **Given** o campo "Horas editadas" aceita fração, **When** o produtor digita `2.5`, **Then** o valor é aceito (escala decimal `numeric(5,2)`, faixa 0–999.99); valores negativos ou não numéricos são rejeitados.
13. **Given** um livro com 2 capítulos — cap. 1 em `pago` e cap. 2 em `pendente` (portanto `book.status = pendente`), **When** o produtor exclui o capítulo 2 (`pendente`), **Then** `book.status` é recomputado transacionalmente para `pago` (todos os capítulos remanescentes estão em `pago`).
14. **Given** um livro com 1 capítulo em `pago` (portanto `book.status = pago`), **When** o produtor abre "Editar livro" e aumenta a quantidade de capítulos para 2 (adiciona 1 capítulo novo em `pendente`), **Then** `book.status` é recomputado transacionalmente para `pendente` (nem todos os capítulos estão `pago`).
15. **Given** um livro com todos os capítulos em `pago` (logo `book.price_per_hour` está bloqueado por FR-037), **When** o produtor reverte **todos** os capítulos de `pago → concluido` via FR-026, **Then** após a última reversão `book.status` passa a `concluido`, nenhum capítulo segue `pago`, e ao abrir "Editar livro" o campo "Valor/hora" (e "Estúdio") voltam a ser **editáveis**. Um novo ciclo de pagamento só retravará os campos quando um capítulo voltar a `pago`.

---

### User Story 6 - Excluir um capítulo individualmente (Priority: P2)

Na tela de detalhes, o produtor clica no ícone "Excluir" de uma linha. Um modal de confirmação pergunta pela exclusão daquele capítulo único.

**Why this priority**: Operação pontual, menos frequente que edição, mas necessária para remover um capítulo criado a mais por engano.

**Independent Test**: Clicar em "Excluir" em uma linha de capítulo, confirmar no modal; verificar que o registro é removido e que a contagem de capítulos do livro na listagem reflete -1.

**Acceptance Scenarios**:

1. **Given** um livro com 10 capítulos, **When** o produtor clica em "Excluir" no capítulo 7 e confirma no modal "Excluir capítulo 7? Esta ação não pode ser desfeita", **Then** o capítulo é removido, a listagem agora mostra 9 capítulos, e a coluna "Capítulos" em `/books` passa a refletir `x/9`.
2. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Cancelar", **Then** nada acontece.
3. **Given** um livro com 1 único capítulo, **When** o produtor clica em "Excluir" no único capítulo e confirma, **Then** o livro inteiro é excluído (cascata por 0 capítulos → livro sem capítulos é inválido) e o produtor é redirecionado para `/books` com toast "Último capítulo removido — livro excluído".
4. **Given** um capítulo em status `pago`, **When** o produtor tenta excluí-lo, **Then** a exclusão é bloqueada com mensagem "Não é possível excluir um capítulo pago" (integridade financeira — Princípio II).

---

### User Story 7 - Modo de exclusão em lote de capítulos (Priority: P2)

Na tela de detalhes, o botão "Excluir capítulos" no cabeçalho ativa um **modo de exclusão**. Nesse modo: uma barra aparece acima do cabeçalho ("N capítulos selecionados", botões "Cancelar" e "Confirmar"); cada linha da tabela ganha um checkbox; um checkbox no cabeçalho da tabela permite selecionar/desselecionar todos. Ao confirmar, um modal final pede a confirmação da exclusão múltipla.

**Why this priority**: Operação em lote agiliza remoção de vários capítulos de uma vez.

**Independent Test**: Entrar no modo de exclusão, selecionar 3 capítulos, confirmar e verificar que os 3 são removidos atomicamente.

**Acceptance Scenarios**:

1. **Given** a tela de detalhes com 10 capítulos, **When** o produtor clica em "Excluir capítulos" no cabeçalho, **Then** a tela entra em "modo de exclusão": uma barra superior "0 capítulos selecionados" aparece acima do cabeçalho com botões "Cancelar" e "Confirmar" (desabilitado enquanto seleção = 0); checkboxes surgem na tabela (um por linha + um no header para selecionar todos); os ícones de edição/exclusão por linha e o botão "Editar livro" são **ocultados** (não apenas desabilitados) para manter a interface livre de affordances irrelevantes ao modo.
2. **Given** o modo de exclusão ativo, **When** o produtor marca 3 checkboxes, **Then** a barra exibe "3 capítulos selecionados" e o botão "Confirmar" fica habilitado.
3. **Given** o modo de exclusão ativo, **When** o produtor marca o checkbox do cabeçalho, **Then** todos os capítulos **exceto os em status `pago`** são selecionados (capítulos pagos ficam desabilitados e não são incluídos); o contador reflete a quantidade selecionada.
4. **Given** 3 capítulos selecionados, **When** o produtor clica em "Confirmar" na barra superior, **Then** um modal final é exibido ("Excluir 3 capítulos? Esta ação não pode ser desfeita. Capítulos pagos são preservados.") com botões "Cancelar" e "Excluir".
5. **Given** o modal final de confirmação é aceito, **When** a operação é executada, **Then** os 3 capítulos são removidos atomicamente em uma única transação; os números dos capítulos restantes **permanecem inalterados** (sem reindexação) para preservar rastreabilidade; um toast de sucesso é exibido.
6. **Given** todos os capítulos (não-pagos) do livro foram selecionados e confirmados para exclusão em lote, **When** a operação é executada, **Then**:
   - Se não houver nenhum capítulo `pago` remanescente, o livro inteiro é excluído e o produtor é redirecionado para `/books` com toast "Todos os capítulos removidos — livro excluído".
   - Se houver capítulos `pago` preservados, o livro permanece com apenas esses capítulos `pago`.
7. **Given** o modo de exclusão ativo, **When** o produtor clica em "Cancelar" na barra superior, **Then** o modo é desativado, todas as seleções são descartadas e a tela volta ao modo normal.
8. **Given** o modo de exclusão ativo, **When** o produtor recarrega a página ou navega para fora e volta, **Then** o modo volta ao estado normal (seleção é efêmera por sessão).

---

### User Story 8 - Editar informações básicas do livro e aumentar quantidade de capítulos (Priority: P2)

No cabeçalho da tela de detalhes, o botão "Editar livro" abre um modal semelhante ao de criação, permitindo editar: título, estúdio, valor/hora do livro (se e somente se nenhum capítulo estiver `pago`) e **aumentar** a quantidade de capítulos. Diminuir a quantidade é explicitamente bloqueado com dica orientando a usar a exclusão de capítulos.

**Why this priority**: Correção de dados e expansão do livro são operações menos frequentes mas necessárias.

**Independent Test**: Abrir modal de edição, alterar título e aumentar quantidade de capítulos em +3, confirmar; verificar que os novos 3 capítulos em status `pendente` aparecem no fim da listagem.

**Acceptance Scenarios**:

1. **Given** um livro com 10 capítulos, nenhum `pago`, **When** o produtor clica em "Editar livro" no cabeçalho, **Then** um modal abre pré-preenchido com os campos atuais (título, estúdio, valor/hora, quantidade de capítulos = 10) todos editáveis.
2. **Given** o modal está aberto com valor atual "R$ 75,00" e há pelo menos um capítulo em status `pago`, **When** o produtor visualiza o campo "Valor/hora", **Then** o campo está **desabilitado** com tooltip "O valor/hora não pode ser alterado após qualquer capítulo ter sido pago" (Princípio II). Os demais campos (título, estúdio, quantidade) continuam editáveis, exceto estúdio (ver cenário 7).
3. **Given** o modal está aberto com "Quantidade de capítulos" = 10, **When** o produtor tenta digitar ou clicar `-` para um valor < 10, **Then** a ação é bloqueada e uma dica aparece abaixo do campo: "Para reduzir o número de capítulos, use 'Excluir capítulos' na tela do livro." O campo não aceita valores menores que a quantidade atual.
4. **Given** o modal está aberto com "Quantidade de capítulos" = 10, **When** o produtor altera para 13 (incremento de +3) e confirma, **Then** o livro é atualizado e **3 novos capítulos** em status `pendente`, numerados 11, 12, 13, são criados atomicamente na mesma transação; os capítulos existentes (1–10) não são alterados; o modal fecha, a listagem da tela reflete 13 linhas e a tabela `/books` exibe `x/13`.
5. **Given** o modal está aberto, **When** o produtor edita título/estúdio e confirma, **Then** a atualização persiste; o livro permanece com os mesmos capítulos.
6. **Given** o modal está aberto e o produtor altera "Título" para um que já existe no mesmo estúdio (ou no novo estúdio selecionado), **When** confirma, **Then** a atualização falha com `409 TITLE_ALREADY_IN_USE`.
7. **Given** o livro possui pelo menos um capítulo em status `pago`, **When** o produtor visualiza o modal de edição, **Then** o campo "Estúdio" também está **desabilitado** com tooltip "O estúdio não pode ser alterado após qualquer capítulo ter sido pago".
8. **Given** o modal está aberto, **When** o produtor clica em "Cancelar", **Then** nenhuma alteração é feita.

---

### User Story 9 - Registrar e abrir PDF do livro (Priority: P3)

No cabeçalho da tela de detalhes, o botão "Ver PDF" abre um **popover/tooltip** com um input onde o produtor pode colar/editar a URL do PDF do livro. Um botão dentro do popover "Abrir em nova guia" abre a URL atual em `target="_blank"`.

**Why this priority**: Integração opcional com PDF externo; útil mas não bloqueante.

**Independent Test**: Clicar em "Ver PDF", colar URL válida, salvar, clicar "Abrir em nova guia" e verificar que o browser abre a URL em nova aba.

**Acceptance Scenarios**:

1. **Given** um livro sem `pdf_url` definida, **When** o produtor clica em "Ver PDF", **Then** um popover abre com um input vazio para URL, botão "Salvar" (desabilitado enquanto vazio) e mensagem "Cole o link do PDF do livro".
2. **Given** o popover está aberto e o produtor cola "https://example.com/book.pdf" em formato válido, **When** clica em "Salvar", **Then** a URL persiste no banco, o popover passa a mostrar a URL salva, um botão "Abrir em nova guia" fica visível e um toast de sucesso é exibido.
3. **Given** o livro tem `pdf_url` definida, **When** o produtor clica em "Ver PDF", **Then** o popover abre pré-preenchido com a URL e o botão "Abrir em nova guia" fica visível.
4. **Given** o popover está aberto com URL, **When** o produtor clica em "Abrir em nova guia", **Then** uma nova aba abre com a URL persistida (não o valor corrente do input se houver edição não salva).
5. **Given** o popover está aberto, **When** o produtor digita uma URL em formato inválido (ex: `"not-a-url"`) e tenta salvar, **Then** uma validação rejeita com mensagem "URL inválida — deve começar com http:// ou https://".
6. **Given** a URL está salva, **When** o produtor apaga o conteúdo do input e salva, **Then** a URL é removida (`pdf_url` = `null`) e o botão "Abrir em nova guia" deixa de existir.

---

### User Story 10 - Bloquear exclusão de estúdio com livros em status ativo (Priority: P2)

Em `/studios`, ao tentar excluir um estúdio que possui pelo menos um **livro em status ativo** (livro com qualquer capítulo em `pendente`, `em edição`, `em revisão` ou `edição retake`), a exclusão é bloqueada com mensagem explicando o vínculo. Estúdios cujos livros estão todos em `concluído`/`pago` (nenhum capítulo ativo) podem ser excluídos.

**Why this priority**: Integridade referencial — prevenir órfãos e perda de dados operacionais. Referência direta a FR-010 de `specs/015-narrators-crud/spec.md`.

**Independent Test**: Criar estúdio S, criar livro L em S com 1 capítulo `pendente`, tentar excluir S; verificar bloqueio `409`. Mover todos os capítulos para `concluído`, tentar excluir S novamente; verificar comportamento esperado.

**Acceptance Scenarios**:

1. **Given** um estúdio "Sonora Studio" com 1 livro "Dom Casmurro" contendo pelo menos 1 capítulo em `pendente`, **When** o produtor tenta excluir "Sonora Studio" em `/studios`, **Then** a exclusão falha com `409 STUDIO_HAS_ACTIVE_BOOKS` e o modal/toast exibe: "Não é possível excluir — este estúdio possui 1 livro com capítulos ativos (Dom Casmurro)."
2. **Given** todos os capítulos dos livros de "Sonora Studio" estão em status `concluído` ou `pago`, **When** o produtor tenta excluir "Sonora Studio", **Then** o estúdio é **soft-deleted** (`deleted_at = now()`): desaparece de `/studios` e do seletor de estúdios nos modais de livro, mas os livros históricos permanecem acessíveis em `/books` e `/books/:id` exibindo o nome do estúdio a partir da FK. Nenhum capítulo `pago` é alterado.
3. **Given** um estúdio sem livros cadastrados, **When** o produtor tenta excluir, **Then** o estúdio é soft-deleted (`deleted_at = now()`) e removido imediatamente da listagem `/studios`.
4. **Given** um estúdio "Sonora Studio" foi soft-deleted (`deleted_at IS NOT NULL`), **When** o produtor tenta criar um novo estúdio com o mesmo nome "Sonora Studio" (seja em `/studios` ou via criação inline no modal de livro), **Then** o sistema **reativa** o registro existente (seta `deleted_at = NULL` na mesma transação) em vez de retornar conflito. Um toast informa: "Um estúdio com esse nome foi desarquivado." Os demais campos (`default_hourly_rate`, `created_at`, etc.) são preservados — exceto quando o desarquive ocorre via criação inline no modal de livro (US3): nesse caso, `default_hourly_rate` é redefinido para `R$ 0,01` (FR-012) e segue a regra de propagação na criação do livro (FR-012a), com toast adicional alertando o produtor.

---

### User Story 11 - Bloquear exclusão de narrador/editor com capítulos em livros ativos (Priority: P2)

Em `/narrators` e `/editors`, ao tentar excluir um narrador ou editor vinculado a pelo menos um capítulo cujo livro esteja em status ativo (pelo menos um capítulo em `pendente`, `em edição`, `em revisão` ou `edição retake`), a exclusão é bloqueada. Narradores/editores vinculados apenas a capítulos em livros 100% `concluído`/`pago` podem ser excluídos (e suas referências tornam-se históricas/`NULL`-áveis conforme regra de FK).

**Why this priority**: Integridade referencial (FR-010 de narrators-crud).

**Independent Test**: Vincular narrador N a um capítulo em `em edição`; tentar excluir N; verificar bloqueio `409`. Após capítulo ser `concluído`/`pago` em livro sem atividade, tentar excluir N novamente e verificar sucesso.

**Acceptance Scenarios**:

1. **Given** narrador "N1" atribuído a pelo menos 1 capítulo cujo livro tem qualquer capítulo em `pendente`/`em edição`/`em revisão`/`edição retake`, **When** o produtor tenta excluir "N1" em `/narrators`, **Then** a exclusão falha com `409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS` e mensagem "Não é possível excluir — este narrador está vinculado a capítulos de livros em andamento (X capítulos em Y livros)".
2. **Given** editor "E1" atribuído apenas a capítulos em livros 100% `concluído`/`pago`, **When** o produtor tenta excluir "E1" em `/editors`, **Then** "E1" é **soft-deleted** (`deleted_at = now()`): desaparece da listagem `/editors` e do seletor "Editor" em edição de capítulo, mas a linha persiste no banco e capítulos históricos continuam exibindo o nome "E1".
3. **Given** narrador "N2" sem capítulos vinculados, **When** o produtor tenta excluir "N2", **Then** "N2" é soft-deleted (`deleted_at = now()`) e removido imediatamente da listagem `/narrators`.
4. **Given** existiu narrador "N3" com `name = "Ana Silva"` que foi soft-deleted, **When** o produtor tenta criar um novo narrador "Ana Silva", **Then** o sistema **reativa** o registro existente (seta `deleted_at = NULL`) e exibe toast "Um narrador com esse nome foi desarquivado." Histórico de capítulos do narrador é preservado e o registro volta a aparecer em `/narrators`. O mesmo comportamento se aplica a editores (`/editors`).

---

### User Story 12 - Coluna "Livros" em `/studios` e coluna "Capítulos" em `/narrators` e `/editors` (Priority: P3)

Após o CRUD de Livros e Capítulos existir:
- A tabela de `/studios` ganha uma coluna "Livros" com a contagem de livros daquele estúdio, ordenável.
- As tabelas de `/narrators` e `/editors` ganham uma coluna "Capítulos" com a contagem de capítulos atribuídos àquela pessoa, ordenável.

**Why this priority**: Enriquecimento visual e operacional, não bloqueante para o MVP.

**Independent Test**: Criar 3 livros em um estúdio e verificar que `/studios` exibe "3" na coluna Livros para aquele estúdio; vincular narrador a 5 capítulos e verificar que `/narrators` exibe "5" na coluna Capítulos.

**Acceptance Scenarios**:

1. **Given** estúdio "Sonora" com 3 livros e estúdio "Voz" com 0 livros, **When** o produtor acessa `/studios`, **Then** a tabela exibe "3" para "Sonora" e "0" para "Voz" na coluna "Livros".
2. **Given** narrador "N1" atribuído a 5 capítulos (distribuídos em qualquer livro), **When** o produtor acessa `/narrators`, **Then** a tabela exibe "5" na coluna "Capítulos" para "N1".
3. **Given** editor "E1" atribuído a 2 capítulos, **When** o produtor acessa `/editors`, **Then** a tabela exibe "2" na coluna "Capítulos" para "E1".
4. **Given** qualquer tabela acima, **When** o produtor clica no cabeçalho da nova coluna, **Then** a ordenação (ASC/DESC) é aplicada conforme padrão das demais colunas.

---

### Edge Cases

- **Invariante "livro tem ≥ 1 capítulo"**: A invariante é absoluta. Cenários que a preservam: (a) livro recém-criado nasce com N ≥ 1 capítulos (FR-010 exige quantidade ≥ 1); (b) após exclusão em lote que preserva capítulos `pago`, o livro permanece porque ainda tem ≥ 1 capítulo; (c) quando a última linha remanescente (não-`pago`) seria removida e nenhum `pago` existe, o livro é **excluído em cascata** automaticamente (FR-028, FR-033) — NÃO fica zerado. Não existe estado válido "livro com 0 capítulos".
- **Aumento de capítulos com título duplicado no mesmo estúdio**: A regra de unicidade do título **não** é afetada por alteração apenas na quantidade; só é reavaliada se título ou estúdio mudarem.
- **Transferir livro para outro estúdio**: permitido via "Editar livro" desde que nenhum capítulo esteja `pago` (Princípio II — imutabilidade financeira do livro após pagamento). Quando há capítulo `pago`, alterar estúdio é bloqueado com tooltip explicativo.
- **Edição concorrente de linhas de capítulo**: última confirmação vence (last-write-wins); se o registro foi excluído por outro usuário, um toast de erro é exibido e a linha desaparece.
- **Pesquisa na listagem**: filtro cliente-side por "contém" em título **ou** nome do estúdio (case-insensitive); não afeta ordenação.
- **Requisição de rede falha**: toast de erro genérico; estado da UI é revertido ao anterior à operação otimista.
- **Múltiplos modais/popovers abertos simultaneamente**: apenas um modal primário é exibido por vez (padrão shadcn Dialog); o popover "Ver PDF" é ancorado ao botão.
- **Navegação direta para `/books/:id` com ID inválido**: 404 pela `not-found.tsx` global.
- **Numeração de capítulos após exclusões**: nunca reindexada — capítulos novos recebem sempre `max(numero) + 1` para preservar rastreabilidade (A2).

## Requirements *(mandatory)*

### Functional Requirements

#### Listagem de Livros (`/books`)

- **FR-001**: O sistema DEVE exibir uma tabela em `/books` com as colunas "Título", "Estúdio", "Capítulos" (formato `concluídos/totais`), "Status", "R$/hora" (BRL) e "Ganho total" (BRL), **sem** coluna de ações.
- **FR-002**: O sistema DEVE exibir uma barra de pesquisa que filtra no client por "contém" (case-insensitive) em `título` ou `estúdio.nome`.
- **FR-003**: O sistema DEVE exibir um botão "+ Novo Livro" que abre o modal de criação (FR-010).
- **FR-004**: As linhas DEVEM ser ordenadas por `created_at` DESC no primeiro render (via `useMemo` no client), espelhando o padrão de `/studios`.
- **FR-005**: Os cabeçalhos das colunas ordenáveis DEVEM permitir alternância ASC/DESC, padrão já em uso nas demais tabelas.
- **FR-006**: Ao clicar em qualquer linha, o sistema DEVE navegar para `/books/:id` (tela de detalhes, FR-018+).
- **FR-007**: Se a lista estiver vazia, o sistema DEVE exibir um estado vazio com CTA "+ Novo Livro".
- **FR-008**: Ações de edição/exclusão por linha NÃO DEVEM aparecer na listagem (gerenciamento acontece na tela de detalhes).
- **FR-009**: A coluna "Capítulos concluídos" DEVE contar capítulos cujo `status` esteja em {`concluido`, `pago`} (valores do enum conforme FR-025).

#### Modal de criação de livro

- **FR-010**: O sistema DEVE exibir um modal com os campos: "Título" (texto, obrigatório, máx 255), "Estúdio" (seletor obrigatório), "Valor/hora" (BRL cents-first, R$ 0,01–R$ 9.999,99, obrigatório), "Quantidade de capítulos" (inteiro, 1–999, obrigatório, default 1) com controles `-`/`+` e digitação livre.
- **FR-011** (US2): O seletor de "Estúdio" DEVE listar estúdios ativos (`deleted_at IS NULL`) exibindo `nome` + `default_hourly_rate` formatado em BRL, ordenados por nome ASC. Cobre a necessidade básica do MVP de US2 — selecionar um estúdio pré-existente para o livro.
- **FR-011a** (US3): O seletor de "Estúdio" DEVE oferecer a opção destacada "+ Novo Estúdio" como último item da lista, que abre o subformulário inline descrito em FR-012. Este requisito pertence a US3 e entra no escopo apenas após a implementação da criação inline; MVP que entregue somente US1+US2 pode omitir o botão "+ Novo Estúdio" sem violar FR-011.
- **FR-012**: Ao acionar "+ Novo Estúdio", o sistema DEVE exibir um subformulário com campo "Nome" (obrigatório, único conforme o constraint case-insensitive parcial `studio_name_unique_active` sobre `lower(name)` com `WHERE deleted_at IS NULL`); ao confirmar, o estúdio DEVE ser persistido **imediatamente** com `default_hourly_rate = R$ 0,01` (valor mínimo placeholder), **independentemente** do conteúdo do campo "Valor/hora do livro" no modal. A criação inline do estúdio NÃO depende de nenhum outro campo do modal de livro estar preenchido — o estúdio nasce imediatamente válido e selecionável. Colisão com estúdio soft-deleted dispara desarquive automático (FR-046a).
- **FR-012a**: Quando a criação do livro é confirmada com sucesso e o estúdio selecionado foi **criado inline nessa mesma sessão do modal** (sinalizado pelo client via `inlineStudioId` no payload de `POST /books`), o service DEVE — na **mesma transação** da criação do livro — atualizar `studio.default_hourly_rate` para o valor de `book.price_per_hour`. Se o estúdio selecionado for **pré-existente** (nenhum `inlineStudioId` enviado), o `default_hourly_rate` dele NÃO é alterado — permanece com o valor atual independentemente do `price_per_hour` escolhido para o livro. Validações de segurança no server: (a) o `inlineStudioId` DEVE existir; (b) o estúdio DEVE estar atualmente com `default_hourly_rate = R$ 0,01` (guard contra abuso — estúdios ativos com rate já propagado não são elegíveis); (c) ownership — o usuário autenticado DEVE ter permissão de escrita sobre o estúdio (reusa as regras de auth já aplicadas em `PATCH /studios`). Não há janela de recência temporal; a combinação `default_hourly_rate === 0.01` + ownership é suficiente.
- **FR-013**: Ao confirmar o livro, o sistema DEVE criar atomicamente o livro + N capítulos em status `pendente` (numerados de 1 a N), em uma única transação; em caso de erro, todo o conjunto é revertido (exceto qualquer estúdio que tenha sido criado inline anteriormente — ver FR-014).
- **FR-014**: Se o produtor criar um estúdio inline e depois cancelar o modal do livro (sem concluir a criação do livro), o estúdio **permanece** persistido com `default_hourly_rate = R$ 0,01` (não há rollback da criação do estúdio); o sistema DEVE exibir um toast de atenção com a mensagem "O estúdio '<nome>' foi criado com valor/hora padrão muito baixo (R$ 0,01). Ajuste em `/studios` antes de usá-lo em outro livro." A propagação do valor/hora do livro para o `default_hourly_rate` (FR-012a) **não ocorre** quando o livro não é criado.
- **FR-015**: O sistema DEVE validar unicidade do título por estúdio (case-insensitive após `trim`): um mesmo título pode coexistir em estúdios distintos, mas não no mesmo estúdio — conflito retorna `409 TITLE_ALREADY_IN_USE`.
- **FR-016**: Os controles `-`/`+` da quantidade de capítulos DEVEM respeitar os limites [1, 999]; a digitação livre DEVE aceitar apenas dígitos.
- **FR-017**: Todas as falhas de servidor DEVEM ser exibidas na UI (inline nos campos quando possível, toast para erros genéricos) sem vazar stack traces.

#### Tela de detalhes do livro (`/books/:id`)

- **FR-018**: O sistema DEVE renderizar um cabeçalho com: título, estúdio, R$/hora (BRL), capítulos concluídos/totais, ganho total (BRL, calculado como Σ `capítulo.horas_editadas × livro.preço_por_hora`), status do livro (ver FR-019), botão "Ver PDF", botão "Editar livro", botão "Excluir capítulos".
- **FR-019**: O sistema DEVE persistir em `book.status` o status agregado do livro como um **cache materializado** derivado dos capítulos (enum com os mesmos valores de `chapter.status`). O campo NÃO é editável diretamente via API ou UI. A camada de service (um helper único `recomputeBookStatus(bookId, tx)`) DEVE recomputar e gravar `book.status` na **mesma transação** de qualquer mutação que afete o conjunto ou o estado dos capítulos do livro, incluindo: (a) criação do livro com N capítulos iniciais; (b) criação de novos capítulos via "Editar livro"; (c) atualização de status/narrador/editor/horas de um capítulo; (d) exclusão individual de capítulo; (e) exclusão em lote de capítulos; (f) reversão de um capítulo `pago → concluído` (FR-026). Regra de cálculo (ordem de precedência de cima para baixo): `pago` se todos os capítulos são `pago`; `concluído` se todos são `concluído`/`pago` com ≥ 1 `concluído`; `em_revisao` se ≥ 1 em `em_revisao`/`edicao_retake`; `em_edicao` se ≥ 1 em `em_edicao`; `pendente` caso contrário. Testes de integração DEVEM validar pelo menos os seguintes cenários: (i) livro com 2 capítulos (1 `pago` + 1 `pendente`) → excluir o `pendente` → `book.status = pago`; (ii) livro com 1 capítulo `pago` → adicionar 1 capítulo novo (`pendente`) → `book.status = pendente`.
- **FR-020**: O sistema DEVE renderizar uma tabela de capítulos do livro com colunas: "Nº", "Status" (badge), "Narrador", "Editor", "Horas editadas", "Ações" (editar/excluir); capítulos DEVEM ser listados em ordem crescente de `numero`.
- **FR-021**: O sistema DEVE oferecer um controle/link "Voltar" que retorna a `/books`.
- **FR-022**: Se `/books/:id` apontar para um livro inexistente, o sistema DEVE retornar 404 utilizando `not-found.tsx` global.

#### Edição/exclusão de capítulo (inline, por linha)

- **FR-023**: Cada linha de capítulo DEVE oferecer ícones "Editar" e "Excluir" no modo normal; em modo edição, os ícones são substituídos por "Cancelar" e "Confirmar", e as células da linha tornam-se inputs/selects.
- **FR-024**: Em modo de edição, os campos editáveis são exatamente quatro: "Status" (select limitado às transições válidas a partir do status atual, conforme FR-025), "Narrador" (select), "Editor" (select), "Horas editadas" (decimal ≥ 0, escala `numeric(5,2)`, faixa 0–999.99). O número do capítulo é imutável. Não existe campo "Páginas" nem `num_paginas` no modelo de domínio.
- **FR-025**: O sistema DEVE aplicar a máquina de estados do capítulo. Valores do enum são persistidos em snake_case sem acentuação (`pendente`, `em_edicao`, `em_revisao`, `edicao_retake`, `concluido`, `pago`); labels em pt-BR com acentuação são aplicados apenas na camada de apresentação (A15). Transições válidas:
  - `pendente → em_edicao` exige narrador atribuído.
  - `em_edicao → em_revisao` exige editor + `horas_editadas > 0`.
  - `em_revisao → edicao_retake` é permitido (reprovação opcional).
  - `edicao_retake → em_revisao` é permitido.
  - `em_revisao → concluido` é permitido.
  - `concluido → pago` é permitido.
  - `pago → concluido` é permitido **somente mediante confirmação dupla** (ver FR-026). Nenhuma outra transição a partir de `pago` é permitida.
  - Qualquer outra transição DEVE ser rejeitada com `422 INVALID_STATUS_TRANSITION`.
- **FR-026**: Capítulos em status `pago` são **parcialmente imutáveis**: Narrador, Editor e Horas editadas permanecem desabilitados em UI e o backend rejeita mutações desses campos com `409 CHAPTER_PAID_LOCKED`. O **Status**, porém, aceita a transição `pago → concluido` mediante **modal de confirmação dupla** em UI (mensagem: "⚠ Reverter status de 'Pago' para 'Concluído'. Essa ação afeta a auditoria financeira. Deseja continuar?"). O backend exige que a requisição contenha um flag explícito `confirmReversion: true` — na ausência do flag, rejeita com `422 REVERSION_CONFIRMATION_REQUIRED`. Após reversão, os demais campos do capítulo voltam a ser editáveis. Se a reversão tornar o livro sem capítulos `pago`, `book.price_per_hour` volta a ser editável (FR-037).
- **FR-027**: O sistema DEVE validar que capítulo em status `pago` **não pode ser excluído** — nem individualmente (FR-028) nem em lote (FR-031). Backend rejeita com `409 CHAPTER_PAID_LOCKED`. Produtor deve reverter o status via FR-026 antes de excluir.
- **FR-028**: Ao excluir individualmente o último capítulo não-pago de um livro que não tem nenhum capítulo `pago`, o livro DEVE ser excluído em cascata na mesma transação e o produtor redirecionado para `/books`.
- **FR-029**: A linha em modo de edição DEVE restaurar os valores originais ao "Cancelar".

#### Modo de exclusão em lote

- **FR-030**: O botão "Excluir capítulos" no cabeçalho DEVE ativar um "modo de exclusão": barra superior ("N capítulos selecionados" + botões "Cancelar" e "Confirmar" — Confirmar desabilitado se N=0), checkboxes por linha, checkbox "select all" no header da tabela, ocultação/desabilitação de botões de ação por linha e do botão "Editar livro".
- **FR-031**: Capítulos em status `pago` DEVEM ter checkbox desabilitado e NÃO DEVEM ser incluídos no "select all".
- **FR-032**: Ao confirmar a exclusão em lote, o sistema DEVE exibir um modal final com contagem e aviso; ao aprovar, todos os selecionados são excluídos em uma única transação, sem reindexar números remanescentes.
- **FR-033**: Se todos os capítulos **não-pagos** do livro forem excluídos e não restarem capítulos `pago`, o livro DEVE ser excluído em cascata e o produtor redirecionado para `/books`.
- **FR-034**: Se restarem apenas capítulos `pago`, o livro DEVE permanecer com esses capítulos preservados.
- **FR-035**: "Cancelar" na barra superior DEVE sair do modo de exclusão e descartar seleção; o modo é efêmero (não persiste entre navegações).

#### Editar livro

- **FR-036**: O botão "Editar livro" no cabeçalho DEVE abrir um modal similar ao de criação, com campos pré-preenchidos: título, estúdio, valor/hora, quantidade de capítulos.
- **FR-037**: O campo "Valor/hora" DEVE ser **desabilitado** se pelo menos um capítulo do livro estiver **atualmente** em status `pago` (Princípio II — imutabilidade financeira enquanto houver capítulo pago), com tooltip explicativo. Se todos os capítulos `pago` forem revertidos para `concluido` via FR-026, o campo volta a ser editável — essa é a única via para destravar a edição do valor/hora após um pagamento.
- **FR-038**: O campo "Quantidade de capítulos" DEVE ter mínimo **igual** à quantidade atual (não permite reduzir); uma dica orientando o uso de "Excluir capítulos" DEVE ser exibida ao tentar reduzir.
- **FR-039**: Ao aumentar de X para Y (Y > X) e confirmar, Y-X capítulos em status `pendente` DEVEM ser criados na mesma transação, numerados sequencialmente após o maior `numero` existente (preservando exclusões intermediárias; ex: se havia 10 e os de nº 3 e 5 foram excluídos, aumentar de 8 para 10 cria capítulos 11 e 12, **não** preenche 3 e 5).
- **FR-040**: Alterar "Estúdio" é bloqueado se houver capítulo `pago` no livro (`409 BOOK_PAID_STUDIO_LOCKED`).
- **FR-041**: Alterar "Título" para um que já existe no estúdio selecionado deve falhar com `409 TITLE_ALREADY_IN_USE` — reaplica a mesma regra de unicidade por estúdio (case-insensitive, após `trim`) definida em FR-015.

#### PDF do livro

- **FR-042**: O botão "Ver PDF" no cabeçalho DEVE abrir um popover com input de URL e botão "Salvar"; se já existir `pdf_url` persistida, o popover DEVE exibir também um botão "Abrir em nova guia".
- **FR-043**: O sistema DEVE validar que a URL começa com `http://` ou `https://` e tem tamanho ≤ 2048 caracteres; inválidas são rejeitadas com `422 INVALID_URL`.
- **FR-044**: "Abrir em nova guia" DEVE abrir a URL persistida (não o valor corrente do input se houver edição não salva); a abertura DEVE usar `target="_blank"` + `rel="noopener noreferrer"`.
- **FR-045**: Salvar com input vazio DEVE remover a URL (`pdf_url = null`).

#### Constraints de exclusão referencial

- **FR-046**: "Excluir estúdio" em `/studios` DEVE ser implementado como **soft-delete** — o sistema marca `studio.deleted_at = now()` ao invés de remover a linha. Pré-condição: o sistema DEVE bloquear a ação (`409 STUDIO_HAS_ACTIVE_BOOKS`) se o estúdio possuir pelo menos um livro com ≥ 1 capítulo em status ativo (`pendente`, `em_edicao`, `em_revisao`, `edicao_retake`). Quando todos os livros do estúdio têm todos os capítulos em `concluido`/`pago` (ou não há livros), o soft-delete é aceito; os livros históricos e seus capítulos `pago` NÃO são modificados (Princípio II — imutabilidade financeira preservada). Estúdios soft-deleted DEVEM ser filtrados de: (a) listagem `/studios`, (b) seletor de estúdio em modais de livro (criação/edição), (c) contagem da coluna "Livros" em FR-050. A FK `book.studio_id` continua resolvendo para o estúdio soft-deleted (para exibir nome na listagem/detalhe de livros).
- **FR-046a**: **Desarquive automático por colisão de nome** — ao tentar criar um estúdio (via `/studios` ou via criação inline em FR-012) cujo `name` colide com um estúdio soft-deleted existente (comparação case-insensitive após `trim`, idêntica ao constraint único), o sistema DEVE **reativar o registro existente** (`UPDATE studio SET deleted_at = NULL WHERE id = <id>`) na mesma transação, em vez de retornar `409 NAME_ALREADY_IN_USE`. Resposta HTTP é `200 OK` (reativação) em vez de `201 Created`, com `meta.reactivated: true` no envelope. UI exibe toast "Um estúdio com esse nome foi desarquivado." Campos preservados por padrão: `default_hourly_rate` original, `created_at`, `id`. **Exceção — flag `inline`**: quando o payload de `POST /studios` inclui explicitamente `inline: true` (sinal do client de que a criação vem do subformulário inline do modal de livro, FR-012), a reativação DEVE sobrescrever `default_hourly_rate` para o valor enviado no payload (tipicamente `R$ 0,01`), retornar `meta.rateResetForInline: true` e seguir a regra de propagação FR-012a quando o livro for efetivamente criado. A UI exibe um toast adicional avisando o produtor sobre a redefinição do rate histórico. Não existe UX de desarquive via listagem (ex: toggle "mostrar arquivados") no MVP — o desarquive ocorre exclusivamente por colisão de nome.
- **FR-047**: "Excluir narrador" em `/narrators` DEVE ser implementado como **soft-delete** — o sistema marca `narrator.deleted_at = now()`. Pré-condição: bloquear (`409 NARRATOR_LINKED_TO_ACTIVE_CHAPTERS`) se o narrador estiver vinculado a ≥ 1 capítulo em livro com ≥ 1 capítulo em status ativo. Narradores soft-deleted DEVEM ser filtrados de: (a) listagem `/narrators`, (b) seletor "Narrador" ao editar capítulos, (c) contagem da coluna "Capítulos" (FR-051). A FK `chapter.narrator_id` continua resolvendo para o nome do narrador em capítulos históricos.
- **FR-047a**: **Desarquive automático por colisão de nome (narrador)** — ao criar um narrador cujo `name` colide com um narrador soft-deleted existente (comparação conforme constraint único da entidade), o sistema DEVE reativar o registro (`UPDATE narrator SET deleted_at = NULL`). Resposta `200 OK { reactivated: true }`. UI exibe toast "Um narrador com esse nome foi desarquivado." Todos os campos originais (incluindo vínculos históricos via FK) são preservados.
- **FR-048**: "Excluir editor" em `/editors` DEVE seguir a mesma semântica de soft-delete de FR-047, com pré-condição e filtros simétricos aplicados a `editor.deleted_at` e à FK `chapter.editor_id`; código de erro `409 EDITOR_LINKED_TO_ACTIVE_CHAPTERS`.
- **FR-048a**: **Desarquive automático por colisão de nome (editor)** — simétrico a FR-047a, aplicado a `editor.deleted_at`. Resposta `200 OK { reactivated: true }`, toast "Um editor com esse nome foi desarquivado."
- **FR-049**: Quando o soft-delete é aceito (FR-047/FR-048), as referências históricas em capítulos `concluído`/`pago` DEVEM continuar resolvendo o nome original do narrador/editor via FK — auditabilidade de ganhos passados preservada integralmente.

#### Colunas derivadas nas demais telas

- **FR-050**: A tabela de `/studios` DEVE receber uma coluna "Livros" (contagem de livros por estúdio), ordenável, computada server-side na leitura.
- **FR-051**: As tabelas de `/narrators` e `/editors` DEVEM receber uma coluna "Capítulos" (contagem de capítulos atribuídos à pessoa), ordenável, computada server-side na leitura.

#### Arquitetura e schema

- **FR-052**: Cada tabela do banco (`studio`, `book`, `chapter`) DEVE estar em **um arquivo de schema separado** sob `src/lib/db/schema/` (um arquivo por entidade), exportados por um barrel (`index.ts`) para preservar compatibilidade com o Drizzle. As tabelas pré-existentes (auth) permanecem onde estão; apenas a reorganização de entidades de domínio faz parte desta feature.
- **FR-053**: Todas as mutações que afetam múltiplas tabelas (criar livro + N capítulos; aumentar capítulos; excluir todos os capítulos e o livro; excluir estúdio em cascata permitida) DEVEM ocorrer em **uma transação atômica** por requisição.
- **FR-054**: Valores monetários (`book.price_per_hour`) DEVEM ser `numeric(10,2)`. Horas editadas (`chapter.horas_editadas`) DEVEM ser `numeric(5,2)` (0–999.99). O campo `chapter.num_paginas integer NOT NULL DEFAULT 0` é **preservado no schema** por força do Princípio XIII (KPI 4 "Média de duração por página" em feature futura), mas **NÃO é exposto** em UI, Zod de API, contratos REST nem componentes desta feature — permanece com `DEFAULT 0` até que uma feature posterior habilite sua edição. Ver [plan.md Complexity Tracking #2](./plan.md) para justificativa.
- **FR-055**: Toda FK DEVE possuir índice. Conflitos de unicidade DEVEM ser representados por constraints únicos no banco (FK + `UNIQUE(book.title, book.studio_id)` case-insensitive via `lower()`).
- **FR-056**: Endpoints DEVEM seguir o padrão REST plural kebab-case: `GET/POST /api/v1/books`, `GET/PATCH/DELETE /api/v1/books/:id`, `POST /api/v1/books/:id/chapters/bulk-delete`, `PATCH/DELETE /api/v1/chapters/:id`. Validação por Zod; status codes corretos (`201`, `204`, `409`, `422`).

### Key Entities

- **Book (Livro)**: pertence a um **Estúdio** (FK obrigatória). Atributos: `id` (uuid), `title` (varchar 255), `studio_id` (FK), `price_per_hour` (numeric(10,2), imutável quando qualquer capítulo estiver `pago`), `pdf_url` (varchar 2048, nullable), `status` (enum mesmo domínio de `chapter.status`: `pendente` | `em_edicao` | `em_revisao` | `edicao_retake` | `concluido` | `pago` — **cache materializado** recomputado pelo service em toda mutação de capítulo, nunca editável diretamente), `created_at`, `updated_at`. Constraint único: `UNIQUE(lower(title), studio_id)`. Invariantes: (i) `book.status` sempre igual à derivação dos capítulos conforme FR-019; (ii) um livro sempre tem ≥ 1 capítulo (criado com ≥ 1 capítulo e excluído automaticamente quando o último capítulo não-pago é removido e não há capítulo `pago` remanescente).
- **Chapter (Capítulo)**: pertence a um **Livro** (FK obrigatória). Atributos: `id` (uuid), `book_id` (FK), `numero` (inteiro ≥ 1, único por livro), `status` (enum: `pendente` | `em_edicao` | `em_revisao` | `edicao_retake` | `concluido` | `pago`), `narrator_id` (FK nullable), `editor_id` (FK nullable), `horas_editadas` (numeric(5,2), default 0), `created_at`, `updated_at`. Não existe campo `num_paginas`. Invariantes: transições de status restritas (FR-025); capítulo `pago` tem imutabilidade parcial — narrador/editor/horas bloqueados, mas status pode reverter para `concluido` com confirmação dupla (FR-026); `pago` não pode ser excluído (FR-027).
- **Studio (Estúdio)** — **pré-existente**, recebe migração aditiva: nova coluna `deleted_at timestamp nullable` (soft-delete, ver FR-046). Esta feature adiciona: (i) a **constraint de exclusão** via soft-delete (FR-046); (ii) a **coluna derivada "Livros"** (FR-050); (iii) filtros globais `deleted_at IS NULL` em toda leitura de estúdios (listagem, seletores). `default_hourly_rate` continua como sugestão que pré-preenche `book.price_per_hour` no momento da criação (conforme clarificação da feature 019). O constraint único de `studio.name` é preservado incluindo registros soft-deleted.
- **Narrator/Editor** — **pré-existentes**, recebem migração aditiva: nova coluna `deleted_at timestamp nullable` em ambas as tabelas. Esta feature adiciona: (i) a **constraint de exclusão** via soft-delete (FR-047, FR-048); (ii) a **coluna derivada "Capítulos"** (FR-051); (iii) filtros globais `deleted_at IS NULL` em toda leitura de narradores/editores (listagem, seletores, contagens). Constraints únicos (`narrator.name`, `editor.name`) preservados incluindo soft-deleted.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O produtor consegue criar um novo livro (com estúdio existente e 10 capítulos) em **menos de 30 segundos** a partir do clique em "+ Novo Livro".
- **SC-002**: O produtor consegue criar um novo livro **incluindo a criação inline de um estúdio novo** em **menos de 45 segundos** sem sair do modal.
- **SC-003**: Na tela de detalhes, o produtor consegue mover 1 capítulo de `pendente` para `em edição` (atribuindo narrador) em **menos de 15 segundos** sem recarregar a página.
- **SC-004**: O produtor consegue excluir 5 capítulos em lote em **menos de 20 segundos** (entrar no modo, selecionar 5, confirmar duplamente, ver resultado).
- **SC-005**: A listagem `/books` renderiza com até **500 livros** sem travamento perceptível (< 200ms para filtro/ordenação client-side após primeira carga).
- **SC-006**: **100%** das transições de status inválidas são bloqueadas em UI **e** backend (cobertura total de testes para a máquina de estados).
- **SC-007**: **0 ocorrências** de alteração bem-sucedida de `price_per_hour` em livros com capítulo `pago` (Princípio II); qualquer tentativa retorna `409`.
- **SC-008**: **0 ocorrências** de exclusão bem-sucedida de estúdio/narrador/editor vinculados a livros/capítulos em status ativo; todas retornam `409` com mensagem explicativa.
- **SC-009**: O ganho total exibido na listagem e no cabeçalho iguala `Σ (capítulo.horas_editadas × livro.price_per_hour)` **exatamente** (sem arredondamento oculto além do formato BRL de 2 casas).
- **SC-010**: Cobertura de testes da feature **≥ 80%** geral e **100%** para o cálculo de ganho, derivação de status do livro e máquina de estados de capítulo.
- **SC-011**: A coluna "Livros" em `/studios` e "Capítulos" em `/narrators`/`/editors` refletem a contagem real com **latência < 100ms** adicional à leitura da tabela (via `COUNT` agregado na query).

## Assumptions

- **A1 — Fonte de verdade do status**: Capítulo continua sendo a fonte operacional da verdade (Princípio I); `book.status` é um **cache materializado** persistido no livro, recomputado pela camada de service em toda mutação relevante de capítulo dentro da mesma transação. O campo não é editável diretamente — sempre derivado (ver FR-019). Justificativa de Q1 (sessão 2026-04-23, Opção C): performance de listagem previsível (uma coluna lida em vez de agregação condicional) com custo de redundância mitigado por ponto único de recomputação no service e validação por teste de integração.
- **A2 — Numeração de capítulos**: Ao criar um livro com N capítulos, são gerados N registros numerados de 1 a N. Ao aumentar de X para Y (Y > X), os novos capítulos recebem números sequenciais a partir do maior `numero` existente + 1 — **nunca** reutilizam números de capítulos previamente excluídos (rastreabilidade histórica).
- **A3 — Cascata e FK (comportamento unificado entre estúdio, narrador e editor)**: FK `chapter.book_id` é `ON DELETE CASCADE` (remoção do livro remove capítulos). `book.studio_id`, `chapter.narrator_id` e `chapter.editor_id` são `ON DELETE RESTRICT`. Nenhuma FK usa `ON DELETE SET NULL`. Na prática, estúdio/narrador/editor **nunca são hard-deleted** via UI — todos usam soft-delete (FR-046, FR-047, FR-048) com a mesma semântica: `deleted_at` nullable; filtragem em listagens e seletores; FK continua resolvendo nomes em contextos históricos; desarquive automático por colisão de nome (FR-046a, FR-047a, FR-048a). Hard-delete físico (limpeza administrativa) só ocorre via operação direta em banco, fora do escopo desta feature.
- **A4 — Unicidade de título**: Único por estúdio (case-insensitive após `trim`); títulos iguais em estúdios distintos são aceitos.
- **A5 — Criação atômica de livro + capítulos**: Mesma transação; rollback total em erro.
- **A6 — Filtro e ordenação**: Filtro da barra de pesquisa e ordenação das tabelas são **client-side** (useMemo), espelhando o padrão de `/studios`; o servidor retorna todos os livros do usuário autenticado.
- **A7 — Paginação**: Não há paginação no MVP (assume-se ≤ 500 livros por produtor — SC-005). Paginação server-side é **fora de escopo**.
- **A8 — Ganho total**: Formato BRL (2 casas) calculado on-read a partir de `Σ (capítulo.horas_editadas × livro.price_per_hour)` sobre **todos** os capítulos do livro, incluindo os `pago` (essa soma representa o histórico total ganho pelo livro).
- **A9 — Edição do capítulo `pago`**: Imutabilidade **parcial**. Campos Narrador, Editor e Horas editadas bloqueados em UI e em backend (`409 CHAPTER_PAID_LOCKED`). Exclusão também bloqueada (`409 CHAPTER_PAID_LOCKED`). O campo Status aceita exclusivamente a transição `pago → concluido`, mediante modal de confirmação dupla e flag `confirmReversion: true` no payload (FR-026). Após reversão, capítulo volta a ser totalmente editável; se nenhum outro capítulo estiver `pago`, `book.price_per_hour` também desbloqueia.
- **A10 — URL do PDF**: Armazenada em `book.pdf_url` como string; validação de formato apenas (não há verificação de acessibilidade/HEAD HTTP).
- **A11 — Autorização**: Reaproveita a autenticação existente (better-auth); todas as rotas exigem sessão válida; não há escopos/roles novos.
- **A12 — Seed**: Nenhum seed de livros/capítulos em dev ou test (mesma regra adotada em estúdios — Princípio V "Factory, não seed"). Testes usam factories em `__tests__/helpers/factories.ts` (`createTestBook`, `createTestChapter`).
- **A13 — Separação de schemas**: O diretório/arquivo atual `src/lib/db/schema.ts` será refatorado para `src/lib/db/schema/<entidade>.ts` (um arquivo por entidade de domínio) + `src/lib/db/schema/index.ts` barrel. Migrations existentes não são renomeadas; apenas novas migrations para `book` e `chapter` são geradas via `drizzle-kit generate`.
- **A14 — Design.pen**: O design de referência para a tela de detalhes está em `design.pen` (Node ID: YeFYS). O design da listagem e do modal seguem o padrão já consolidado em `/studios`, `/narrators`, `/editors` — nenhuma nova variante visual é criada. Pencil MCP será consultado na fase `/speckit-plan`.
- **A15 — Internacionalização**: Toda UI em pt-BR; valores técnicos de status são persistidos em snake_case sem acentuação no banco (`em_edicao`, `em_revisao`, `edicao_retake`, `concluido`, `pago`) para evitar problemas com enums PostgreSQL; labels traduzidos para pt-BR na camada de apresentação.
- **A16 — Modo de exclusão em lote**: Estado efêmero (React state), perdido em refresh/navegação; não persiste em URL.
- **A17 — Limite de capítulos**: Máximo 999 capítulos por livro (FR-016) — generoso o bastante para qualquer livro real e previne abusos.
- **A18 — Accessibility**: Todos os novos modais, popovers e checkboxes seguem padrão shadcn/ui (focus trap, ARIA labels, keyboard navigation, suporte a reduced-motion).
- **A19 — Dark mode**: Todos os novos componentes suportam tema claro/escuro via tokens semânticos Tailwind (Princípio VII da constituição).
