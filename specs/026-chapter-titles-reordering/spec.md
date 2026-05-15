# Feature Specification: Chapter titles, reordering, and extra-chapter templates

**Feature Branch**: `026-chapter-titles-reordering`
**Created**: 2026-05-14
**Status**: Draft (post-grill)
**Input**: User description: "Deve ser possível adicionar títulos aos capítulos (ex: Abertura, Agradecimentos, etc); reordenar os capítulos dos livros; adicionar a opção, no momento da criação/edição de um livro, para adicionar capítulos extras como prólogo, epílogo e apresentação. O usuário deve ser capaz de usar 'templates' dos capítulos extras adicionais mais comuns: prólogo, epílogo e apresentação; como também deve ser capaz de adicionar capítulos extras personalizados."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Título como identidade do capítulo (Priority: P1)

Hoje cada capítulo é identificado apenas pelo seu número sequencial ("Capítulo 1", "Capítulo 2"). Audiobooks reais misturam capítulos numerados com seções editoriais — Prólogo, Apresentação, Agradecimentos, Sobre o autor, Epílogo. O número sequencial não consegue representar essas seções sem distorcer a contagem ("a Apresentação não é o Capítulo 1"). Esta história substitui o número sequencial como rótulo canônico do capítulo por um **título livre obrigatório**. Capítulos tradicionais nascem com título `Capítulo 1`, `Capítulo 2`, …; capítulos editoriais nascem com seu próprio título (`Prólogo`, `Abertura`, etc.).

**Why this priority**: É a fundação das outras duas histórias. Sem desacoplar rótulo de ordem, não dá para reordenar sem mudar nomes, nem para adicionar uma "Apresentação" no meio do livro. Entrega valor sozinha (a tabela passa a mostrar nomes editoriais reais) mesmo sem reordenação nem templates.

**Independent Test**: Editar um capítulo existente, alterar o título de "Capítulo 1" para "Abertura", salvar, e verificar que todas as telas que listam capítulos (tabela do livro, agrupamento, foco da semana) passam a exibir "Abertura". Pode ser validado sem reordenação e sem capítulos extras.

**Acceptance Scenarios**:

1. **Given** um capítulo com título `Capítulo 1`, **When** o operador edita o título para `Abertura` e salva, **Then** o título exibido em todas as telas passa a ser `Abertura`, e a ordem do capítulo no livro permanece a mesma.
2. **Given** um capítulo com status `paid`, **When** o operador tenta alterar o título, **Then** o sistema bloqueia a edição com a mesma mensagem padrão de imutabilidade já usada para `edited_seconds`, `narrator`, `editor` e `deadline`.
3. **Given** o operador digitando um título com apenas espaços, **When** salva, **Then** o sistema rejeita com mensagem "Título é obrigatório", em português.
4. **Given** o operador digitando um título com 101 caracteres, **When** salva, **Then** o sistema rejeita com mensagem "Título deve ter no máximo 100 caracteres".
5. **Given** dois capítulos do mesmo livro com o mesmo título (ex.: dois `Agradecimentos`), **When** o operador salva, **Then** o sistema aceita — títulos não são únicos dentro de um livro.
6. **Given** um capítulo com título contendo acentos, emoji ou caracteres não-latinos, **When** salva, **Then** o sistema aceita e renderiza fielmente; quebras de linha (`\n`/`\r`) são rejeitadas.

---

### User Story 2 — Reordenar capítulos dentro de um livro (Priority: P2)

Durante o cadastro, é comum descobrir que a ordem em que os capítulos foram criados não corresponde à ordem real do audiobook. Hoje a única saída é excluir e recriar, perdendo narrador atribuído, tempo editado e status. A reordenação dentro da tabela permite ajustar a sequência preservando todos os dados do capítulo.

A reordenação **não toca** nenhum dado financeiro nem o título do capítulo — só muda a posição visual. Por isso, é permitida independente do status: mesmo capítulos `paid` podem ser reordenados livremente.

**Why this priority**: Depende da existência da tabela de capítulos (já existe) mas é independente do título e dos templates. Entrega valor mesmo se as outras duas histórias atrasarem.

**Independent Test**: Em um livro com 3 capítulos na ordem A → B → C, mover o capítulo C para o topo via interação direta, recarregar a página, e confirmar que a ordem persistiu como C → A → B. Validável sem títulos descritivos e sem capítulos extras.

**Acceptance Scenarios**:

1. **Given** um livro com 4 capítulos nas posições 0-1-2-3, **When** o operador move o capítulo da posição 3 para a posição 1 e confirma, **Then** a nova ordem 0-3-1-2 fica persistida e é exibida em todas as telas que listam capítulos.
2. **Given** o operador navegando exclusivamente por teclado, **When** ele foca um capítulo e usa atalho de teclado (ou os botões ↑/↓ visíveis na linha) para movê-lo, **Then** o sistema move o capítulo com o mesmo efeito do arrasto pelo mouse e anuncia a mudança via tecnologias assistivas.
3. **Given** o operador em uma tela móvel ou tablet, **When** ele tenta reordenar via gesto e a interação conflita com o scroll da tabela, **Then** os botões ↑/↓ visíveis em cada linha permanecem como alternativa funcional.
4. **Given** uma operação de reordenação em andamento, **When** ocorre falha de salvamento (rede/servidor), **Then** a UI volta para a ordem anterior e exibe mensagem de erro padronizada — nenhuma ordem parcial é persistida.
5. **Given** dois operadores editando o mesmo livro em paralelo, **When** o segundo tenta salvar uma reordenação baseada em estado desatualizado, **Then** o sistema rejeita a operação com erro de conflito em PT-BR e instrui o usuário a recarregar a lista.
6. **Given** um livro com capítulos em estados mistos (alguns `pending`, alguns `paid`), **When** o operador reordena qualquer um deles, **Then** o sistema aceita — a posição é puramente organizacional e não toca nenhum dado financeiro nem o título.
7. **Given** uma reordenação concluída, **When** o operador olha o capítulo movido, **Then** seu título, status, narrador, editor, `edited_seconds` e `deadline` permanecem inalterados.

---

### User Story 3 — Adicionar capítulos via templates ou personalizados (Priority: P3)

Toda criação ou ampliação da composição do livro passa por uma única ação explícita: **adicionar capítulo**. Não existe mais o caminho implícito de "aumentar o número de capítulos no diálogo de edição". O operador escolhe:

- **Capítulo numerado** — título pré-preenchido como `Capítulo N` (onde N é o próximo da sequência considerando apenas capítulos cujo título segue esse padrão); operador pode editar o texto.
- **Template `Prólogo` / `Epílogo` / `Apresentação`** — título pré-preenchido pelo nome do template.
- **Capítulo personalizado** — operador digita um título livre no momento da adição.

A operação também define a posição de inserção (no início, no fim, ou depois de um capítulo específico já existente). Adição é permitida em qualquer estado do livro, inclusive quando há capítulos `paid` — o capítulo novo nasce `pending` e não toca os existentes.

**Why this priority**: Depende do título (US1) para fazer sentido visual e da reordenação (US2) para que a UX de "posição de inserção" seja consistente com o gesto de mover. Entrega o maior ganho de produtividade no cadastro e na correção pós-fato (esqueci o Epílogo, acrescento agora).

**Independent Test**: No diálogo de criação de livro, definir "5 capítulos numerados" e marcar "+ Adicionar Prólogo (no início)" + "+ Adicionar Epílogo (no fim)", salvar, e verificar que o livro nasceu com 7 capítulos na ordem `Prólogo`, `Capítulo 1`, …, `Capítulo 5`, `Epílogo`. Validável independente da reordenação.

**Acceptance Scenarios**:

1. **Given** o diálogo de criação de livro com 5 capítulos numerados configurados, **When** o operador adiciona "Prólogo" via template no início e "Epílogo" via template no fim, **Then** o livro é criado com 7 capítulos na ordem `Prólogo` → `Capítulo 1` → `Capítulo 2` → `Capítulo 3` → `Capítulo 4` → `Capítulo 5` → `Epílogo`.
2. **Given** o diálogo de criação, **When** o operador adiciona um capítulo personalizado com título `Nota do tradutor` no início, **Then** o livro nasce com `Nota do tradutor` na posição 0 e os demais na sequência configurada.
3. **Given** o operador na página de detalhe de um livro existente, **When** ele clica em "+ Adicionar capítulo", escolhe "Epílogo (template)" e seleciona "no fim", **Then** um novo capítulo `Epílogo` é criado como `pending` na última posição, sem afetar os capítulos anteriores (status, narrador, tempo, título).
4. **Given** o operador na página de detalhe de um livro **com pelo menos um capítulo `paid`**, **When** ele adiciona um capítulo extra, **Then** o sistema aceita a criação — o capítulo nasce `pending` e o `book.status` é recomputado automaticamente para refletir a mistura de estados (mesmo comportamento de qualquer mutação de capítulo).
5. **Given** o operador adicionando dois capítulos com o mesmo template "Prólogo", **When** salva, **Then** o sistema aceita; títulos duplicados são permitidos.
6. **Given** o operador escolhendo a opção "Personalizado", **When** o seletor revela o campo de texto e ele deixa em branco e tenta confirmar, **Then** o sistema rejeita com a mesma mensagem de US1 ("Título é obrigatório").
7. **Given** o operador adicionando capítulo numerado em um livro que já tem `Capítulo 1`, `Capítulo 2`, `Prólogo`, **When** o sistema sugere o próximo título, **Then** ele oferece `Capítulo 3` (considera apenas os títulos que seguem o padrão `Capítulo \d+`), e o operador pode aceitar ou editar.
8. **Given** o operador cancela o diálogo de criação após adicionar capítulos numerados e extras, **When** confirma o cancelamento, **Then** nenhum capítulo é persistido — a operação é atômica.

---

### Edge Cases

- **Título com apenas espaços em branco**: trim aplicado pelo servidor; resultado vazio → erro 422.
- **Título extremamente longo**: limite de 100 caracteres aplicado consistentemente entre formulário (Zod) e armazenamento (CHECK).
- **Newline embutido no título**: rejeitado pelo servidor (título precisa caber em uma linha de tabela).
- **Livro sem nenhum capítulo numerado, apenas extras** (ex.: só `Apresentação` e `Epílogo`): cenário válido; não há requisito de capítulos numerados.
- **Capítulo extra com mesmo título de capítulo numerado**: aceito; a identidade real é o identificador interno do capítulo.
- **Reordenação alterando a posição de capítulos com `edited_seconds > 0` ou status `paid`**: permitida; posição é puramente organizacional.
- **Cancelar diálogo de criação após selecionar templates**: nenhum capítulo é persistido — operação é atômica.
- **Operações concorrentes em outras mutações** (não apenas reorder): a versão de composição protege contra adição/exclusão/reorder concorrentes que partam de estado desatualizado.
- **Importar/duplicar livro existente**: fora de escopo; esta feature não cobre clonagem.
- **Migração de livros legados sem `title`**: tratamento descrito em FR-Migração.

## Requirements *(mandatory)*

### Functional Requirements

#### Títulos

- **FR-001**: Cada capítulo MUST ter um título textual obrigatório, em substituição à identificação anteriormente baseada em número sequencial.
- **FR-002**: O título MUST aceitar até 100 caracteres, qualquer Unicode exceto `\n` e `\r`, com trim aplicado pelo servidor antes da persistência.
- **FR-003**: O título MUST ser editável a qualquer momento, **exceto** quando o capítulo está com status `paid` — nesse caso a regra é a mesma já aplicada a `narrator_id`, `editor_id`, `edited_seconds` e `deadline`.
- **FR-004**: Capítulos criados sem título customizado pelo operador MUST receber título default conforme regra de geração: capítulo numerado recebe `Capítulo N` (sem zero-padding, sem prefixo no número); capítulo via template recebe o nome do template (`Prólogo`, `Epílogo`, `Apresentação`).
- **FR-005**: Títulos default MUST permanecer estáveis após qualquer reordenação ou adição posterior — o sistema **não** renumera automaticamente capítulos cujo título segue o padrão `Capítulo \d+` quando a ordem muda.
- **FR-006**: Títulos MUST ser permitidos com duplicatas dentro do mesmo livro; não há restrição de unicidade.
- **FR-007**: O cálculo do "próximo número" para capítulo numerado adicionado a um livro existente MUST considerar **apenas** os títulos que seguem o padrão `Capítulo \d+`, ignorando capítulos editoriais; o sucessor é `max(N) + 1`.

#### Ordenação

- **FR-008**: Cada capítulo MUST ter uma posição inteira não-negativa, única dentro do livro, formando uma sequência densa de `0` a `N-1`.
- **FR-009**: Usuários MUST poder reordenar capítulos via interação direta (arrastar e soltar com mouse/touch) **e** via botões ↑/↓ sempre visíveis em cada linha, garantindo acessibilidade por teclado.
- **FR-010**: A reordenação MUST anunciar mudanças via tecnologias assistivas (ex.: "Capítulo X movido para posição Y de N").
- **FR-011**: A nova ordem MUST ser persistida atomicamente — ou todas as posições refletem a nova ordem, ou nenhuma muda.
- **FR-012**: A reordenação MUST ser permitida em qualquer estado do livro, incluindo livros com capítulos `paid` — posição é organizacional, não financeira.
- **FR-013**: A reordenação MUST manter inalterados todos os outros campos do capítulo: `title`, `status`, `narrator_id`, `editor_id`, `edited_seconds`, `deadline`.
- **FR-014**: O sistema MUST detectar conflitos de edição concorrente via uma versão de composição do livro, incrementada em toda mutação de capítulo (criação, edição, exclusão, reordenação). Operações baseadas em versão desatualizada MUST ser rejeitadas com mensagem em PT-BR e código de erro do catálogo `errorCodes`.

#### Adição de capítulos (numerados, templates e personalizados)

- **FR-015**: O diálogo de **criação** de livro MUST permitir definir, em uma única operação atômica: (i) quantidade de capítulos numerados (gerados com título default `Capítulo 1..N`); (ii) lista de capítulos extras, cada um com escolha de template (`Prólogo`/`Epílogo`/`Apresentação`) ou título personalizado, e posição relativa (`no início`, `no fim`, `depois de outro capítulo extra da lista`).
- **FR-016**: O diálogo de **edição** de livro MUST deixar de aceitar aumento da quantidade de capítulos via campo numérico. O campo `Capítulos` e a mensagem auxiliar de redução são removidos.
- **FR-017**: A página de **detalhe** do livro MUST oferecer um botão "+ Adicionar capítulo" que abre o mesmo seletor usado na criação: escolha entre capítulo numerado, template ou personalizado, e seleção de posição (`no início`, `no fim`, `depois de um capítulo específico`).
- **FR-018**: O catálogo de templates MUST ser fixo nesta entrega: `Prólogo`, `Epílogo`, `Apresentação`. Não há persistência de templates no banco; eles são conveniências de UI que pré-preenchem o `title`.
- **FR-019**: Adicionar capítulo MUST ser permitido em qualquer estado do livro, inclusive quando há capítulos `paid` — o capítulo novo nasce `pending` e o status agregado do livro é recomputado na mesma transação.
- **FR-020**: A operação de criar livro com capítulos numerados + extras MUST ser atômica — falha em qualquer parte resulta em nenhum capítulo persistido.

#### Migração de dados existentes

- **FR-021**: A migração MUST remover a coluna `number` da tabela `chapter` e seus constraints associados (unique `(book_id, number)`, check `number >= 1`).
- **FR-022**: A migração MUST adicionar coluna `title` (`text NOT NULL`, com check `length <= 100`) e fazer backfill com a fórmula `title = 'Capítulo ' || number::text` para todos os capítulos existentes.
- **FR-023**: A migração MUST adicionar coluna `position` (`integer NOT NULL`, unique por livro, check `position >= 0`) e fazer backfill com `position = row_number() over (partition by book_id order by number) - 1` para garantir densidade mesmo quando há buracos na sequência anterior.
- **FR-024**: A migração MUST adicionar coluna `chapters_version` (`integer NOT NULL DEFAULT 0`) na tabela `book` para suportar detecção de conflito.
- **FR-025**: A migração MUST ser reversível: a migração de rollback recria `number` a partir de `position + 1` antes de remover `title` e `position`.

#### Comportamento geral

- **FR-026**: Todas as mensagens de erro e validação relacionadas à feature MUST ser exibidas em português brasileiro, seguindo o catálogo `errorCodes` existente.
- **FR-027**: Toda mutação de título, posição, criação ou exclusão de capítulo MUST recomputar `book.status` (cache materializado) e bumpar `book.chapters_version` na mesma transação.
- **FR-028**: A feature MUST funcionar em modo claro e escuro, sem cores hardcoded, usando tokens semânticos do tema.
- **FR-029**: A feature 024 (agrupamento de capítulos) MUST passar a exibir `title` no lugar de "Capítulo N" em todas as suas linhas; a ordenação dentro de cada grupo MUST ser por `position` ascendente.
- **FR-030**: A feature 025 (foco da semana e coluna "Prazo") MUST continuar funcionando sem regressão; a ordenação dentro do filtro de foco MUST ser por `position` ascendente.
- **FR-031**: A ordenação default da tabela de capítulos MUST passar a ser por `position` ascendente em substituição à ordenação anterior por `number` ascendente.

### Key Entities *(include if feature involves data)*

- **Capítulo**: ganha o atributo obrigatório `title` (texto até 100 caracteres) e `position` (inteiro não-negativo, único por livro, denso 0..N-1); perde o atributo `number`. Mantém todos os outros atributos (`status`, `narrator_id`, `editor_id`, `edited_seconds`, `deadline`, `book_id`). O título substitui o número como identidade visual; a posição substitui o número como chave de ordenação.
- **Livro**: ganha o atributo `chapters_version` (inteiro não-negativo, incrementado em toda mutação que afete a composição de capítulos do livro). Não há outras mudanças no livro.
- **Template de capítulo**: catálogo fixo de três opções em UI (`Prólogo`, `Epílogo`, `Apresentação`). Atua apenas como conveniência de pré-preenchimento do `title`; **não** é uma entidade persistida no banco e **não** afeta o modelo do servidor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O fluxo de cadastro de livro com 1 prólogo + N capítulos numerados + 1 epílogo é feito em uma única ação atômica (um diálogo, sem edição pós-criação), reduzindo em pelo menos 40% o tempo médio em relação ao fluxo atual (criar livro → ampliar capítulos → renomear → reordenar).
- **SC-002**: 100% das tentativas de alterar `title`, `narrator_id`, `editor_id`, `edited_seconds` ou `deadline` em capítulos `paid` resultam em bloqueio claro com mensagem PT-BR, sem corrupção de dados.
- **SC-003**: 100% das reordenações concluídas com sucesso refletem a nova ordem em todas as telas que listam capítulos (tabela default, agrupamento, foco da semana) sem necessidade de refresh manual, em menos de 1 segundo após o salvamento.
- **SC-004**: Zero divergências entre a ordem exibida na tabela de capítulos do livro e a ordem exibida em telas dependentes (agrupamento, foco da semana, detalhe) após qualquer reordenação ou adição.
- **SC-005**: Operações concorrentes de reordenação ou adição em estado desatualizado falham 100% das vezes com mensagem de conflito clara, sem sobrescrita silenciosa.
- **SC-006**: A migração de dados existentes para `title`/`position` preserva a ordem visual original em 100% dos livros do banco de produção e de teste; nenhum capítulo é perdido ou tem dados alterados além de `number → title/position`.
- **SC-007**: A invariante "positions de cada livro são densas, começando em 0, sem buracos nem duplicatas" é verificada por teste de integridade após cada operação que afeta composição (criação, exclusão, reorder), com cobertura 100% das mutações.

## Assumptions

- Reordenação é uma propriedade puramente organizacional/visual: não influencia cálculo de ganho, status do livro, prazo, nem qualquer regra financeira. O capítulo continua sendo a unidade central.
- O título do capítulo é texto livre, sem catálogo controlado nem normalização — duas obras podem ter capítulos com o mesmo título, e o mesmo livro pode repetir títulos sem erro.
- A geração default `Capítulo N` é pré-preenchimento de UI/serviço, não um conceito de modelagem. O usuário pode renomear qualquer capítulo gerado para o texto que quiser, sem afetar comportamento do sistema.
- O conjunto de templates pré-definidos é fixo nesta entrega (`Prólogo`, `Epílogo`, `Apresentação`). Adicionar novos templates ao catálogo é trabalho futuro e fora de escopo.
- "Capítulo extra" é apenas rotulagem de UI no momento da adição: tecnicamente todos os capítulos são iguais; o que muda é apenas o ponto de partida do título e a posição sugerida.
- Livros existentes ganham o título via backfill determinístico (`Capítulo N`) e mantém ordem visual exata via backfill de `position`. A migração é não-destrutiva e reversível.
- O fluxo assume cardinalidade típica de até ~50 capítulos por livro; otimizações para livros com centenas de capítulos não fazem parte desta entrega.
- Conflitos de edição concorrente são raros mas devem ser detectados (não silenciosamente sobrescritos) via versão de composição do livro.
- A feature 024 (agrupamento) e a feature 025 (prazo/foco da semana) continuam funcionando sem regressão; ambas passam a usar `title` em vez de "Capítulo N" e `position` em vez de `number` para ordenação.
- O caminho de criação implícita de capítulos via aumento do campo `Capítulos` no diálogo de edição é **removido** nesta entrega. Toda criação de capítulo passa a ser explícita.

## Out of Scope

- Adicionar limites de comprimento (`length <= N`) a outras colunas textuais do projeto (`book.title`, `studio.name`, `narrator.name`, `editor.name`). Reconhecido como melhoria desejável durante o grill, fica como follow-up.
- Catálogo configurável de templates além dos três fixos.
- Clonagem ou duplicação de livro com a estrutura de capítulos.
- Sort por outras colunas (deadline, status, narrador) na tabela de capítulos — a ordem padrão continua sendo `position` ascendente; sort customizado pode ser adicionado depois sem impactar esta feature.
- Importação em massa de capítulos via CSV ou similar.
- Histórico/auditoria de mudanças de título ou posição.
