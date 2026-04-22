# Feature Specification: CRUD de Estúdios

**Feature Branch**: `019-studios-crud`
**Created**: 2026-04-21
**Status**: Clarified (4 perguntas resolvidas em 2026-04-21)
**Input**: User description: "CRUD de Estúdios — a tela segue o mesmo padrão de /editors e /narrators. Seguir design.pen (Node ID: rkZ68). A coluna 'Livros' está anotada em futuras-features.md para ser implementada quando o CRUD de Livros existir."

## Clarifications

### Session 2026-04-21

- Q: Campo "Valor/hora" no estúdio conflita com o Princípio II (preço/hora nunca ao estúdio)? → A: **Opção A** — `default_hourly_rate` é um valor-padrão/sugestão que pré-preenche o `preço_por_hora` do livro **apenas no momento da criação**. Após a criação, o livro carrega seu próprio `preço_por_hora` imutável (quando `pago`) e alterações futuras no estúdio não afetam livros já criados. Princípio II preservado — cálculos de ganho continuam usando exclusivamente o preço do livro. Exemplo: Estúdio A (R$ 50) cria Livro A (2h) → Livro A nasce com preço 50 e ganho R$ 100. Um mês depois, Estúdio A passa a R$ 100 e cria Livro B (2h) → Livro B nasce com preço 100 e ganho R$ 200. Livro A continua com R$ 50 — nunca é alterado.
- Q: Faixa permitida para `default_hourly_rate` e formato de input do campo "Valor/hora"? → A: Faixa **R$ 0,01 a R$ 9.999,99** (Opção C). Input opera em modo **cents-first**: o usuário digita apenas dígitos e eles se acumulam como centavos — `"85"` → R$ 0,85; `"8500"` → R$ 85,00; `"999999"` → R$ 9.999,99 (máximo). O mesmo componente de input monetário será **reutilizado na criação de Livros**, portanto deve ser genérico (não acoplado ao domínio Estúdio).
- Q: Ordenação padrão da tabela ao carregar `/studios`? → A: **`created_at` DESC** (Opção B), espelhando o padrão atual de `/editors` e `/narrators`. A ordenação é aplicada **apenas no frontend** via `useMemo` no componente `StudiosClient` (`[...studios].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())`). O repository continua retornando `orderBy(asc(studio.createdAt))` — a consistência visual de "novo registro aparece no topo" é responsabilidade do consumer (frontend), não do banco. Decisão herdada da correção aplicada em editors/narrators: ao confirmar a criação de uma nova linha, a linha permanece visualmente no topo em vez de saltar para o final.
- Q: Quantidade e conteúdo de estúdios no seed (`seed.ts` e `seed-test.ts`)? → A: **Nenhum seed de estúdios** (Opção D). `seed-test.ts` permanece inalterado (apenas admin, conforme Princípio V "Factory, não seed" da constituição). `seed.ts` de desenvolvimento **também não** recebe estúdios — o produtor cria manualmente na primeira utilização. Testes E2E e integration criam seus próprios estúdios via factory `createTestStudio(db, overrides)` no `beforeEach` ou no próprio teste. Isso mantém isolamento total entre execuções e evita dependências implícitas em dados pré-existentes.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listar estúdios existentes (Priority: P1)

O produtor acessa a página de Estúdios e visualiza uma tabela com todos os estúdios cadastrados, contendo as colunas "Nome", "Valor/hora" e "Ações". As colunas "Nome" e "Valor/hora" podem ser ordenadas clicando no cabeçalho.

**Why this priority**: Sem a listagem, nenhuma outra operação (criar, editar, excluir) é possível. É o alicerce de todas as demais funcionalidades.

**Independent Test**: Acessar `/studios` e verificar que a tabela renderiza com dados vindos do banco de dados.

**Acceptance Scenarios**:

1. **Given** existem 3 estúdios cadastrados (criados em momentos distintos), **When** o produtor acessa `/studios`, **Then** a tabela exibe 3 linhas com "Nome" e "Valor/hora padrão" de cada estúdio, ordenadas por `created_at` DESC (o mais recente no topo).
2. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "Nome", **Then** as linhas são reordenadas alfabeticamente por nome (ascendente); clicando novamente, inverte para descendente.
3. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "Valor/hora", **Then** as linhas são reordenadas numericamente (ascendente/descendente em clique subsequente).
4. **Given** não existem estúdios cadastrados, **When** o produtor acessa `/studios`, **Then** a tabela exibe um estado vazio com mensagem indicando que não há estúdios cadastrados.
5. **Given** a tabela possui registros, **When** o produtor visualiza a página, **Then** a tabela está envolvida em um ScrollArea que permite scroll vertical caso o conteúdo exceda a área visível.

---

### User Story 2 - Criar novo estúdio (Priority: P1)

O produtor clica no botão "+ Novo Estúdio" e uma nova linha editável aparece na tabela. Ele preenche o nome e o valor/hora padrão e confirma para criar o registro, ou cancela para descartar a linha.

**Why this priority**: Sem criação, o sistema não tem dados para operar. É co-fundamental com a listagem.

**Independent Test**: Clicar em "+ Novo Estúdio", preencher os campos e confirmar; verificar que o registro aparece na tabela e persiste no banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela de estúdios está exibida, **When** o produtor clica em "+ Novo Estúdio", **Then** uma nova linha aparece no topo da tabela com os campos "Nome" (input de texto) e "Valor/hora" (input BRL em modo cents-first, inicia em `R$ 0,00`) editáveis, e botões "Cancelar" e "Confirmar" substituem os ícones de ação.
2. **Given** uma nova linha está em modo de criação com nome e valor/hora preenchidos, **When** o produtor clica em "Confirmar", **Then** o registro é criado no banco de dados, a linha sai do modo editável e exibe os dados confirmados com ícones de "Editar" e "Excluir".
3. **Given** uma nova linha está em modo de criação, **When** o produtor clica em "Cancelar", **Then** a linha é removida da tabela sem criar nenhum registro.
4. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com o campo "Nome" vazio, **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com "Valor/hora" vazio (R$ 0,00) ou fora da faixa permitida (> R$ 9.999,99), **Then** uma mensagem de validação é exibida indicando que o valor precisa estar entre R$ 0,01 e R$ 9.999,99.
6. **Given** uma nova linha está em modo de criação com o input "Valor/hora" vazio, **When** o produtor digita `"8"`, `"5"`, `"0"`, `"0"` em sequência, **Then** o campo exibe `R$ 0,08` → `R$ 0,85` → `R$ 8,50` → `R$ 85,00` (cents-first, acumulando da direita).
7. **Given** o campo "Valor/hora" exibe `R$ 9.999,99`, **When** o produtor tenta digitar um sétimo dígito, **Then** o dígito é ignorado (campo permanece em `R$ 9.999,99`).
6. **Given** já existe um estúdio com nome "Sonora Studio", **When** o produtor tenta criar outro estúdio com o nome "Sonora Studio" (exatamente igual após `trim`, case-sensitive), **Then** a criação falha com `409 NAME_ALREADY_IN_USE` e a mensagem "Nome já cadastrado" é exibida no campo "Nome".

---

### User Story 3 - Editar estúdio existente (Priority: P2)

O produtor clica no ícone de "Editar" em uma linha existente. Os campos de nome e valor/hora se tornam editáveis. Ele pode confirmar as alterações ou cancelar para restaurar os valores anteriores.

**Why this priority**: Edição é essencial para ajustar nome e tabela de preço padrão, mas depende de dados já existentes (criação vem primeiro).

**Independent Test**: Clicar em "Editar" em uma linha, alterar valores, confirmar; verificar que os dados atualizados persistem.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um estúdio "Sonora Studio" com valor/hora "R$ 85,00", **When** o produtor clica no ícone de "Editar" dessa linha, **Then** os campos "Nome" e "Valor/hora" se tornam inputs editáveis com os valores atuais preenchidos, e os botões "Cancelar" e "Confirmar" substituem os ícones de "Editar" e "Excluir".
2. **Given** a linha está em modo de edição com nome alterado para "Sonora Studio Plus", **When** o produtor clica em "Confirmar", **Then** o registro é atualizado no banco de dados, a linha sai do modo de edição e exibe "Sonora Studio Plus".
3. **Given** a linha está em modo de edição com valores alterados, **When** o produtor clica em "Cancelar", **Then** os valores originais são restaurados e a linha volta ao modo de visualização.
4. **Given** a linha está em modo de edição, **When** o produtor limpa o campo "Nome" e clica em "Confirmar", **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** a linha está em modo de edição, **When** o produtor zera "Valor/hora" (campo em `R$ 0,00`) e tenta confirmar, **Then** uma mensagem de validação é exibida indicando que o valor precisa estar entre R$ 0,01 e R$ 9.999,99.
6. **Given** já existem estúdios "Sonora Studio" e "Estúdio Voz & Arte", **When** o produtor edita "Estúdio Voz & Arte" renomeando-o como "Sonora Studio", **Then** a edição falha com `409 NAME_ALREADY_IN_USE` e a mensagem "Nome já cadastrado" é exibida no campo "Nome".
7. **Given** o produtor edita um estúdio mantendo os mesmos valores (nenhuma mudança efetiva), **When** confirma, **Then** a operação é idempotente — a API aceita e os valores continuam válidos (não há falso positivo de conflito contra o próprio registro).

---

### User Story 4 - Excluir estúdio (Priority: P2)

O produtor clica no ícone de "Excluir" e um modal de confirmação é exibido. Ele pode confirmar a exclusão ou cancelar.

**Why this priority**: Exclusão é necessária para manutenção de dados, mas é menos frequente que criação e edição.

**Independent Test**: Clicar em "Excluir", confirmar no modal; verificar que o registro é removido da tabela e do banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um estúdio "Sonora Studio", **When** o produtor clica no ícone de "Excluir" dessa linha, **Then** um modal de confirmação é exibido com a pergunta "Tem certeza que deseja excluir o estúdio Sonora Studio?" e botões "Cancelar" e "Excluir".
2. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Excluir", **Then** o registro é removido do banco de dados, o modal fecha e a linha desaparece da tabela.
3. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Cancelar", **Then** o modal fecha e nenhuma alteração é feita.

---

### Edge Cases

- O que acontece quando o produtor clica em "+ Novo Estúdio" enquanto já existe uma linha em modo de criação? A linha de criação pendente recebe foco e nenhuma nova linha é adicionada.
- O que acontece quando o produtor tenta editar uma linha enquanto outra está em modo de edição? Ambas as edições coexistem — são operações independentes.
- O que acontece quando o produtor clica em "+ Novo Estúdio" enquanto uma linha está em modo de edição? A criação de uma nova linha e a edição de outra coexistem — são operações independentes.
- O que acontece quando a requisição de criação/edição/exclusão falha por erro de rede? Um toast de erro é exibido com mensagem genérica e o estado da UI é revertido ao estado anterior à operação.
- O que acontece quando dois produtores editam o mesmo estúdio simultaneamente? O último a confirmar sobrescreve (last-write-wins); se o registro foi excluído por outro usuário, um erro é exibido.
- "Nome" é comparado como **texto exato após `trim`, case-sensitive** — mesma regra já adotada para Narrador e Editor. "Sonora" e "sonora" são considerados diferentes. Acentos, espaços internos e capitalização fazem parte da chave de unicidade.
- O que acontece se o produtor digita espaços em branco extras no nome? O `trim` remove apenas espaços nas pontas; espaços internos são preservados.
- O que acontece quando o produtor tenta digitar separadores (vírgula, ponto) no input de "Valor/hora"? Caracteres não-numéricos são **ignorados** pelo input cents-first. Apenas dígitos 0-9 são aceitos; a formatação BRL é aplicada automaticamente.
- O que acontece quando o produtor apaga (backspace) dígitos do "Valor/hora"? Cada backspace remove o último dígito acumulado: `R$ 85,00` → `R$ 8,50` → `R$ 0,85` → `R$ 0,08` → `R$ 0,00`.
- O que acontece ao excluir um estúdio que já tenha livros vinculados? **Fora de escopo** desta feature — a constraint "não excluir estúdio com livros" será adicionada quando o CRUD de Livros for implementado (ver `futuras-features.md`). Por enquanto, a exclusão é livre (análogo ao estado atual de Narrador e Editor).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma página autenticada em `/studios` usando `PageContainer`, `PageHeader`, `PageTitle` ("Estúdios") e `PageDescription` ("Gerencie os estúdios parceiros").
- **FR-002**: O sistema DEVE exibir uma tabela com todos os estúdios cadastrados, contendo as colunas "Nome", "Valor/hora" e uma coluna de ações. A coluna "Livros" NÃO está no escopo desta feature — será adicionada quando o CRUD de Livros existir (ver `futuras-features.md`).
- **FR-003**: O sistema DEVE permitir ordenação ascendente e descendente por "Nome" e por "Valor/hora" via clique no cabeçalho (sorting client-side, TanStack Table).
- **FR-003a**: A **ordenação padrão ao carregar a página** DEVE ser **`created_at` DESC** (mais recente primeiro), aplicada **no frontend** (via `useMemo` no componente client) sobre a lista retornada pelo repository. O repository mantém `orderBy(asc(studio.createdAt))` — consistente com `/editors` e `/narrators`. Esta inversão garante que uma linha recém-criada permaneça no topo após a confirmação (não salte para o final).
- **FR-004**: O sistema DEVE permitir a criação de um novo estúdio via linha editável inline na tabela, acionada pelo botão "+ Novo Estúdio".
- **FR-005**: O sistema DEVE validar que o nome é obrigatório (mínimo 2 caracteres, máximo 100 caracteres) ao criar ou editar um estúdio — idêntica à regra aplicada a Narrador e Editor.
- **FR-006**: O sistema DEVE validar que "Valor/hora" é obrigatório, numérico com valor entre **R$ 0,01 (mínimo, inclusivo)** e **R$ 9.999,99 (máximo, inclusivo)**, e com no máximo 2 casas decimais. Persistido como `numeric(10,2)` — conforme Princípio XI da constituição (valores financeiros em `numeric`, nunca `float`). A validação DEVE ocorrer tanto no cliente (Zod) quanto no service antes de persistir.
- **FR-007**: O sistema DEVE permitir edição inline dos campos "Nome" e "Valor/hora" ao clicar no ícone de "Editar" de uma linha existente.
- **FR-008**: O sistema DEVE restaurar os valores originais quando o produtor cancela uma edição.
- **FR-009**: O sistema DEVE exibir um modal de confirmação antes de excluir um estúdio.
- **FR-010**: O sistema DEVE permitir múltiplas operações simultâneas na tabela — edição de linhas existentes e criação de nova linha são ações independentes que coexistem.
- **FR-011**: O sistema DEVE envolver a tabela em um ScrollArea para suportar diferentes tamanhos de fonte sem quebrar o layout.
- **FR-012**: O sistema DEVE exibir um estado vazio com mensagem quando não houver estúdios cadastrados.
- **FR-013**: O sistema DEVE exibir feedback via toast (sonner) apenas em caso de erro nas operações de criação, edição e exclusão.
- **FR-014**: O sistema DEVE garantir unicidade do `name` entre estúdios via índice único (`studio_name_unique`). A migração Drizzle que cria a tabela `studio` DEVE incluir esse índice.
- **FR-015**: A comparação de unicidade do **nome** DEVE ser **case-sensitive e apenas com `trim` nas pontas** — sem lowercasing, sem collapse de espaços internos, sem remoção de acentos; mesma regra de Narrador e Editor.
- **FR-016**: Violação da constraint de unicidade em `name` DEVE ser mapeada a um erro de domínio `StudioNameAlreadyInUseError`. A API REST DEVE responder `409` com código `NAME_ALREADY_IN_USE` tanto em `POST` quanto em `PATCH`.
- **FR-017**: A UI (formulário inline de criação e edição) DEVE exibir a mensagem "Nome já cadastrado" no campo "Nome" ao receber `409 NAME_ALREADY_IN_USE`, usando `setError` do React Hook Form.
- **FR-018**: A API REST DEVE seguir o padrão do projeto: `GET /api/v1/studios`, `POST /api/v1/studios`, `PATCH /api/v1/studios/:id`, `DELETE /api/v1/studios/:id`, com envelopes de resposta consistentes e status codes corretos (`201` criar, `204` excluir, `422` inválido, `409` conflito).
- **FR-019**: A entidade Estúdio DEVE seguir a arquitetura em camadas: `app/api` → `lib/factories` → `lib/services` → `lib/repositories` → `lib/domain`. O controller NUNCA instancia repository ou service diretamente; usa `createStudioService()` do composition root.
- **FR-020**: A página e a API DEVEM estar restritas a usuários autenticados, seguindo o mesmo padrão de proteção de `/narrators` e `/editors`.
- **FR-021**: A página DEVE funcionar corretamente em modo claro e escuro, usando tokens semânticos do Tailwind — nenhuma cor hardcoded.
- **FR-022**: O ícone de "Excluir" na tabela e o botão "Excluir" no modal de confirmação DEVEM usar a cor `destructive` já existente no sistema de design, com o mesmo ajuste para a variante vermelha de cor primária já definido em Narradores/Editores.
- **FR-023**: A feature DEVE adicionar a factory `createTestStudio(db, overrides)` em `__tests__/helpers/factories.ts` para uso em testes integration e E2E. **Nenhum seed é modificado** — `seed-test.ts` permanece com apenas a conta admin (Princípio V da constituição: "Factory, não seed, para novas entidades") e `seed.ts` de desenvolvimento também não recebe estúdios pré-cadastrados. Cada teste cria os estúdios que precisa, mantendo isolamento total.
- **FR-024**: Componentes de feature DEVEM residir em `src/components/features/studios/` (Princípio VII da constituição v2.11.0) — pastas `_components/` dentro de `src/app/` são proibidas.
- **FR-025**: O valor financeiro "Valor/hora" DEVE ser exibido formatado em BRL (`R$ 85,00`) na leitura. O **input de edição opera em modo cents-first**: o usuário digita apenas dígitos e eles se acumulam como centavos da direita para a esquerda. Exemplos: `"8"` → `R$ 0,08`; `"85"` → `R$ 0,85`; `"850"` → `R$ 8,50`; `"8500"` → `R$ 85,00`; `"999999"` → `R$ 9.999,99`. O componente DEVE bloquear a entrada do **sétimo dígito** (limite do teto R$ 9.999,99) e aceitar apenas caracteres numéricos (teclas não-numéricas são ignoradas). **Backspace** remove o último dígito acumulado. Sem campo separado para inteiros/decimais — sempre um único input que formata enquanto o usuário digita.
- **FR-025a**: O componente de input monetário DEVE ser **genérico** (desacoplado do domínio Estúdio) e residir em local compartilhado de `components/ui/` ou `components/shared/`, pois será **reutilizado na criação de Livros** para o campo `preço_por_hora`. A API do componente aceita `value` (number em reais, ex: `85.00`), `onChange` (number em reais), `min`, `max` e props padrão de input.
- **FR-026**: O campo `default_hourly_rate` do estúdio é **apenas um valor padrão/sugestão** para pré-preencher o preço por hora no momento da criação de um livro vinculado ao estúdio — **não participa de nenhum cálculo financeiro**. Após a criação do livro, o `preço_por_hora` do livro é independente do estúdio: alterações posteriores no `default_hourly_rate` do estúdio NÃO afetam livros já criados (ganho do livro continua sendo `horas_editadas × preço_hora_do_livro`). Todo cálculo de ganho continua baseado exclusivamente no `preço_por_hora` do **livro**, imutável quando o livro está `pago`, conforme Princípio II da constituição.

### Reuse vs. Duplication

- **FR-027**: Componentes puramente visuais de `components/ui/` (Button, Input, Table, ScrollArea, Dialog, etc.) DEVEM ser reaproveitados sem duplicação.
- **FR-028**: Componentes de layout (`PageContainer`, `PageHeader`, `PageTitle`, `PageDescription`) DEVEM ser reaproveitados sem duplicação.
- **FR-029**: Componentes de feature específicos de Editores (`editors-client`, `editors-table`, `editor-row`, `editor-new-row`, `delete-editor-dialog`) DEVEM ser **duplicados** como `studios-client`, `studios-table`, `studio-row`, `studio-new-row`, `delete-studio-dialog` — a generalização seria mais custosa que a duplicação, especialmente considerando que Estúdio possui o campo `default_hourly_rate` (numeric) que diverge de Editor (e-mail) e Narrador (apenas nome).
- **FR-030**: Domínio, repository, service, factory, errors e rotas de API DEVEM ser duplicados para Estúdio espelhando a estrutura atual de Editor; não há tentativa de abstração genérica nesta feature.
- **FR-031**: Testes (unit, integration, E2E) DEVEM ser duplicados espelhando a estrutura atual de Editor, ajustando nomes de rotas, factories, campos (substituindo `email` por `default_hourly_rate`) e mensagens.

### Key Entities

- **Estúdio**: Parceiro que contrata a produção e edição de audiobooks. Atributos: identificador único, nome (obrigatório, 2–100 caracteres, **único após `trim`, case-sensitive**), valor/hora padrão (`default_hourly_rate`, `numeric(10,2)`, > 0), timestamps (`created_at`, `updated_at`). Não referencia outras entidades nesta feature — a relação `studio 1→N books` será implementada quando o CRUD de Livros existir.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O produtor consegue criar, editar e excluir estúdios em menos de 10 segundos por operação (equivalente a Narradores/Editores).
- **SC-002**: Todas as operações CRUD (criar, ler, editar, excluir) funcionam corretamente e persistem no banco de dados.
- **SC-003**: A validação de campos impede 100% das submissões com dados inválidos (nome vazio, nome com tamanho inválido, nome duplicado, valor/hora = R$ 0,00, valor/hora > R$ 9.999,99). O input cents-first impede por construção valores com mais de 2 casas decimais e valores negativos.
- **SC-004**: O modal de exclusão previne exclusões acidentais — nenhum estúdio é excluído sem confirmação explícita.
- **SC-005**: O ícone de exclusão é visualmente distinguível da cor primária em todas as 5 variantes de cor primária da aplicação (blue, orange, green, red, amber).
- **SC-006**: A tabela funciona corretamente nas 3 opções de tamanho de fonte (small, medium, large) sem quebra de layout.
- **SC-007**: A página funciona corretamente em modo claro e escuro.
- **SC-008**: Tentar criar ou editar um estúdio com `name` duplicado (após `trim`, case-sensitive) retorna `409 NAME_ALREADY_IN_USE` em 100% dos casos e a UI exibe a mensagem "Nome já cadastrado" no campo "Nome".
- **SC-009**: Valores financeiros exibidos e persistidos respeitam `numeric(10,2)` — nunca aparece erro de ponto flutuante em testes de precisão (ex: `85,00 + 10,00 === 95,00` exato).
- **SC-010**: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` e `bun run build` terminam sem erros nem warnings após a feature.
- **SC-011**: Cobertura de testes da feature ≥ 80% (unit + integration combinados) nos módulos de domínio, service, repository e controllers, consistente com o padrão da constituição.

## Assumptions

- A entidade Estúdio **ainda não existe** no banco de dados — esta feature cria a tabela `studio` via migração Drizzle reversível (`generate` + `migrate`). A estrutura é `id`, `name`, `default_hourly_rate` (numeric(10,2)), timestamps, com um índice único: `studio_name_unique` em `name` (case-sensitive, sem normalização).
- O campo `default_hourly_rate` no estúdio é **um valor padrão/sugestão** usado ao criar livros vinculados ao estúdio — **não participa de nenhum cálculo financeiro**. Todo cálculo de ganho continua baseado exclusivamente no `preço_por_hora` do **livro** (imutável quando o livro está `pago`), conforme Princípio II da constituição. Exemplo: Estúdio A com valor/hora de R$ 50 cria Livro A (2h) → Livro A é persistido com `preço_por_hora = 50` e ganho de R$ 100. Um mês depois, Estúdio A passa a R$ 100/h e cria Livro B (2h) → Livro B nasce com `preço_por_hora = 100` e ganho de R$ 200. O Livro A continua com R$ 50/h — nunca é alterado retroativamente.
- A coluna "Livros" do design.pen **não faz parte desta feature**. Quando o CRUD de Livros for implementado, será adicionada uma coluna com a contagem de livros por estúdio (anotado em `futuras-features.md`).
- A constraint "não excluir estúdio com livros vinculados" está **fora de escopo** desta feature — será adicionada quando o CRUD de Livros for criado. Por enquanto, a exclusão é livre (análogo ao estado atual de Narrador e Editor).
- A página `/studios` já está listada como `favoritePage` válida no schema `user_preference` — a rota apenas passa a existir fisicamente nesta feature.
- A duplicação de UI, domínio e testes entre Editor/Narrador e Estúdio é **aceita explicitamente** pelo produto — consolidação em abstração genérica é desencorajada para manter acoplamento baixo e clareza alta entre entidades que já divergem (Estúdio tem `default_hourly_rate` numeric; Editor tem `email` string; Narrador tem só `name`).
- O design visual segue a referência de `design.pen` (Node ID: rkZ68, "06 - Estúdios") e o padrão já implementado em `/narrators` e `/editors`; nenhuma nova variante visual é criada.
- Apenas usuários autenticados têm acesso à página e às APIs de estúdios — mesmo middleware e guards já aplicados a `/narrators` e `/editors`.
- Volume esperado de estúdios é baixo (poucos parceiros) — tabela não precisa de paginação.
- O formulário inline utiliza React Hook Form com validação Zod, mesmo stack técnica de Editores.
- A tabela utiliza TanStack Table (via shadcn/ui DataTable) com sorting client-side — mesma stack técnica de Editores.
- **Nenhum estúdio é pré-criado via seed** (nem `seed.ts`, nem `seed-test.ts`) — conforme Princípio V da constituição ("Factory, não seed, para novas entidades"). Testes integration e E2E usam a factory `createTestStudio(db, overrides)` em `__tests__/helpers/factories.ts`. Produtor cria manualmente o primeiro estúdio ao acessar `/studios` pela primeira vez em ambiente de desenvolvimento.

