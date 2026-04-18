# Feature Specification: CRUD de Editores

**Feature Branch**: `018-editors-crud`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "CRUD de Editores — tela muito similar à tela de Narradores atual. Reaproveitar componentes quando for mais barato que duplicar; duplicar quando o reaproveitamento for mais trabalhoso. Editor possui nome e e-mail; ambos são únicos."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listar editores existentes (Priority: P1)

O produtor acessa a página de Editores e visualiza uma tabela com todos os editores cadastrados, contendo as colunas "Nome" e "E-mail". As colunas podem ser ordenadas clicando no cabeçalho.

**Why this priority**: Sem a listagem, nenhuma outra operação (criar, editar, excluir) é possível. É o alicerce de todas as demais funcionalidades.

**Independent Test**: Acessar `/editors` e verificar que a tabela renderiza com dados vindos do banco de dados.

**Acceptance Scenarios**:

1. **Given** existem 3 editores cadastrados, **When** o produtor acessa `/editors`, **Then** a tabela exibe 3 linhas com nome e e-mail de cada editor.
2. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "Nome", **Then** as linhas são reordenadas alfabeticamente por nome (ascendente); clicando novamente, inverte para descendente.
3. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "E-mail", **Then** as linhas são reordenadas alfabeticamente por e-mail.
4. **Given** não existem editores cadastrados, **When** o produtor acessa `/editors`, **Then** a tabela exibe um estado vazio com mensagem indicando que não há editores cadastrados.
5. **Given** a tabela possui registros, **When** o produtor visualiza a página, **Then** a tabela está envolvida em um ScrollArea que permite scroll vertical caso o conteúdo exceda a área visível.

---

### User Story 2 - Criar novo editor (Priority: P1)

O produtor clica no botão "+ Novo Editor" e uma nova linha editável aparece na tabela. Ele preenche nome e e-mail e confirma para criar o registro, ou cancela para descartar a linha.

**Why this priority**: Sem criação, o sistema não tem dados para operar. É co-fundamental com a listagem.

**Independent Test**: Clicar em "+ Novo Editor", preencher os campos e confirmar; verificar que o registro aparece na tabela e persiste no banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela de editores está exibida, **When** o produtor clica em "+ Novo Editor", **Then** uma nova linha aparece no topo da tabela com os campos "Nome" e "E-mail" editáveis, e botões "Cancelar" e "Confirmar" substituem os ícones de ação.
2. **Given** uma nova linha está em modo de criação com nome e e-mail preenchidos, **When** o produtor clica em "Confirmar", **Then** o registro é criado no banco de dados, a linha sai do modo editável e exibe os dados confirmados com ícones de "Editar" e "Excluir".
3. **Given** uma nova linha está em modo de criação, **When** o produtor clica em "Cancelar", **Then** a linha é removida da tabela sem criar nenhum registro.
4. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com o campo "Nome" vazio, **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com o campo "E-mail" vazio, **Then** uma mensagem de validação é exibida indicando que o e-mail é obrigatório.
6. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com um e-mail em formato inválido (ex: "carla" ou "carla@"), **Then** uma mensagem de validação é exibida indicando que o formato do e-mail é inválido.
7. **Given** já existe um editor com nome "Carla Mendes", **When** o produtor tenta criar outro editor com o nome "Carla Mendes" (exatamente igual após `trim`), **Then** a criação falha com `409 NAME_ALREADY_IN_USE` e a mensagem "Nome já cadastrado" é exibida no campo "Nome".
8. **Given** já existe um editor com e-mail "carla@studio.com", **When** o produtor tenta criar outro editor com o e-mail "carla@studio.com" (comparação case-insensitive após `trim`), **Then** a criação falha com `409 EMAIL_ALREADY_IN_USE` e a mensagem "E-mail já cadastrado" é exibida no campo "E-mail".

---

### User Story 3 - Editar editor existente (Priority: P2)

O produtor clica no ícone de "Editar" em uma linha existente. Os campos de nome e e-mail se tornam editáveis. Ele pode confirmar as alterações ou cancelar para restaurar os valores anteriores.

**Why this priority**: Edição é essencial para corrigir dados, mas depende de dados já existentes (criação vem primeiro).

**Independent Test**: Clicar em "Editar" em uma linha, alterar valores, confirmar; verificar que os dados atualizados persistem.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um editor "Carla Mendes" com e-mail "carla@studio.com", **When** o produtor clica no ícone de "Editar" dessa linha, **Then** os campos "Nome" e "E-mail" se tornam inputs editáveis com os valores atuais preenchidos, e os botões "Cancelar" e "Confirmar" substituem os ícones de "Editar" e "Excluir".
2. **Given** a linha está em modo de edição com nome alterado para "Carla Mendes Silva", **When** o produtor clica em "Confirmar", **Then** o registro é atualizado no banco de dados, a linha sai do modo de edição e exibe "Carla Mendes Silva".
3. **Given** a linha está em modo de edição com valores alterados, **When** o produtor clica em "Cancelar", **Then** os valores originais ("Carla Mendes", "carla@studio.com") são restaurados e a linha volta ao modo de visualização.
4. **Given** a linha está em modo de edição, **When** o produtor limpa o campo "Nome" e clica em "Confirmar", **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** a linha está em modo de edição, **When** o produtor altera o e-mail para um formato inválido, **Then** uma mensagem de validação é exibida indicando que o formato do e-mail é inválido.
6. **Given** já existem editores "Carla Mendes" e "Diego Rocha", **When** o produtor edita "Diego Rocha" renomeando-o como "Carla Mendes", **Then** a edição falha com `409 NAME_ALREADY_IN_USE` e a mensagem "Nome já cadastrado" é exibida no campo "Nome".
7. **Given** já existem editores com e-mails "carla@studio.com" e "diego@studio.com", **When** o produtor edita Diego alterando o e-mail para "carla@studio.com", **Then** a edição falha com `409 EMAIL_ALREADY_IN_USE` e a mensagem "E-mail já cadastrado" é exibida no campo "E-mail".
8. **Given** o produtor edita um editor mantendo os mesmos valores (nenhuma mudança efetiva), **When** confirma, **Then** a operação é idempotente — a API aceita e os valores continuam válidos (não há falso positivo de conflito contra o próprio registro em nome ou e-mail).

---

### User Story 4 - Excluir editor (Priority: P2)

O produtor clica no ícone de "Excluir" e um modal de confirmação é exibido. Ele pode confirmar a exclusão ou cancelar.

**Why this priority**: Exclusão é necessária para manutenção de dados, mas é menos frequente que criação e edição.

**Independent Test**: Clicar em "Excluir", confirmar no modal; verificar que o registro é removido da tabela e do banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um editor "Carla Mendes", **When** o produtor clica no ícone de "Excluir" dessa linha, **Then** um modal de confirmação é exibido com a pergunta "Tem certeza que deseja excluir o editor Carla Mendes?" e botões "Cancelar" e "Excluir".
2. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Excluir", **Then** o registro é removido do banco de dados, o modal fecha e a linha desaparece da tabela.
3. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Cancelar", **Then** o modal fecha e nenhuma alteração é feita.

---

### Edge Cases

- O que acontece quando o produtor clica em "+ Novo Editor" enquanto já existe uma linha em modo de criação? A linha de criação pendente recebe foco e nenhuma nova linha é adicionada.
- O que acontece quando o produtor tenta editar uma linha enquanto outra está em modo de edição? Ambas as edições coexistem — são operações independentes.
- O que acontece quando o produtor clica em "+ Novo Editor" enquanto uma linha está em modo de edição? A criação de uma nova linha e a edição de outra coexistem — são operações independentes.
- O que acontece quando a requisição de criação/edição/exclusão falha por erro de rede? Um toast de erro é exibido com mensagem genérica e o estado da UI é revertido ao estado anterior à operação.
- O que acontece quando dois produtores editam o mesmo editor simultaneamente? O último a confirmar sobrescreve (last-write-wins); se o registro foi excluído por outro usuário, um erro é exibido.
- "Nome" é comparado como **texto exato após `trim`, case-sensitive** — mesma regra já adotada para Narradores. "Carla" e "carla" são considerados diferentes. Acentos, espaços internos e capitalização fazem parte da chave de unicidade.
- "E-mail" é comparado como **case-insensitive após `trim`** — convenção de indústria para endereços de e-mail. O valor é persistido em minúsculas (normalizado no service antes de chegar ao repository), de modo que "Carla@Studio.com" e "carla@studio.com" são tratados como o mesmo endereço e ambos ficam armazenados como "carla@studio.com".
- O que acontece se a base pré-existente já tiver dois editores com o mesmo `name` ou `email` no momento da migração? A migração falha ao criar o índice único (cenário improvável já que a tabela ainda não existe — é criada por esta feature).
- O que acontece se o produtor digita espaços em branco extras no nome ou no e-mail? O `trim` remove apenas espaços nas pontas; espaços internos no nome são preservados; e-mails com espaços internos são inválidos pelo próprio formato.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE expor uma página autenticada em `/editors` usando `PageContainer`, `PageHeader`, `PageTitle` e `PageDescription` do layout padrão.
- **FR-002**: O sistema DEVE exibir uma tabela com todos os editores cadastrados, contendo as colunas "Nome" e "E-mail" e uma coluna de ações.
- **FR-003**: O sistema DEVE permitir ordenação ascendente e descendente por "Nome" e por "E-mail".
- **FR-004**: O sistema DEVE permitir a criação de um novo editor via linha editável inline na tabela, acionada pelo botão "+ Novo Editor".
- **FR-005**: O sistema DEVE validar que o nome é obrigatório (mínimo 2 caracteres, máximo 100 caracteres) ao criar ou editar um editor — idêntica à regra aplicada a Narrador.
- **FR-006**: O sistema DEVE validar que o e-mail é obrigatório, em formato válido (Zod `.email()` — aproximação pragmática da RFC 5322, mesma convenção adotada no restante do projeto) e com no máximo 255 caracteres, ao criar ou editar um editor.
- **FR-007**: O sistema DEVE permitir edição inline dos campos "Nome" e "E-mail" ao clicar no ícone de "Editar" de uma linha existente.
- **FR-008**: O sistema DEVE restaurar os valores originais quando o produtor cancela uma edição.
- **FR-009**: O sistema DEVE exibir um modal de confirmação antes de excluir um editor.
- **FR-010**: O sistema DEVE permitir múltiplas operações simultâneas na tabela — edição de linhas existentes e criação de nova linha são ações independentes que coexistem.
- **FR-011**: O sistema DEVE envolver a tabela em um ScrollArea para suportar diferentes tamanhos de fonte sem quebrar o layout.
- **FR-012**: O sistema DEVE exibir um estado vazio com mensagem quando não houver editores cadastrados.
- **FR-013**: O sistema DEVE exibir feedback via toast (sonner) apenas em caso de erro nas operações de criação, edição e exclusão.
- **FR-014**: O sistema DEVE garantir unicidade do `name` entre editores via índice único (`editor_name_unique`). A migração Drizzle que cria a tabela `editor` DEVE incluir esse índice.
- **FR-015**: O sistema DEVE garantir unicidade do `email` entre editores via índice único (`editor_email_unique`) sobre o valor normalizado (lowercased). A migração Drizzle que cria a tabela `editor` DEVE incluir esse índice.
- **FR-016**: A comparação de unicidade do **nome** DEVE ser **case-sensitive e apenas com `trim` nas pontas** — sem lowercasing, sem collapse de espaços internos, sem remoção de acentos; mesma regra de Narrador.
- **FR-017**: A comparação de unicidade do **e-mail** DEVE ser **case-insensitive após `trim`** — valor normalizado para minúsculas no service antes de persistir e antes de consultar. "Carla@Studio.com" e "carla@studio.com" são o mesmo endereço e ficam armazenados como "carla@studio.com".
- **FR-018**: Violação da constraint de unicidade em `name` DEVE ser mapeada a um erro de domínio `EditorNameAlreadyInUseError`. A API REST DEVE responder `409` com código `NAME_ALREADY_IN_USE` tanto em `POST` quanto em `PATCH`.
- **FR-019**: Violação da constraint de unicidade em `email` DEVE ser mapeada a um erro de domínio `EditorEmailAlreadyInUseError`. A API REST DEVE responder `409` com código `EMAIL_ALREADY_IN_USE` tanto em `POST` quanto em `PATCH`.
- **FR-020**: A UI (formulário inline de criação e edição) DEVE exibir a mensagem "Nome já cadastrado" no campo "Nome" ao receber `409 NAME_ALREADY_IN_USE` e "E-mail já cadastrado" no campo "E-mail" ao receber `409 EMAIL_ALREADY_IN_USE`, usando `setError` do React Hook Form.
- **FR-021**: A API REST DEVE seguir o padrão do projeto: `GET /api/v1/editors`, `POST /api/v1/editors`, `PATCH /api/v1/editors/:id`, `DELETE /api/v1/editors/:id`, com envelopes de resposta consistentes e status codes corretos (`201` criar, `204` excluir, `422` inválido, `409` conflito).
- **FR-022**: A entidade Editor DEVE seguir a arquitetura em camadas: `app/api` → `lib/factories` → `lib/services` → `lib/repositories` → `lib/domain`. O controller NUNCA instancia repository ou service diretamente; usa `createEditorService()` do composition root.
- **FR-023**: A página e a API DEVEM estar restritas a usuários autenticados, seguindo o mesmo padrão de proteção de `/narrators` e das demais páginas autenticadas.
- **FR-024**: A página DEVE funcionar corretamente em modo claro e escuro, usando tokens semânticos do Tailwind — nenhuma cor hardcoded.
- **FR-025**: O ícone de "Excluir" na tabela e o botão "Excluir" no modal de confirmação DEVEM usar a cor `destructive` já existente no sistema de design, com o mesmo ajuste para a variante vermelha de cor primária já definido em Narradores.
- **FR-026**: A feature DEVE adicionar/atualizar fixtures, factories (`createTestEditor`) e seed de desenvolvimento (`src/lib/db/seed.ts`) — sem tocar `seed-test.ts`.

### Reuse vs. Duplication

- **FR-027**: Componentes puramente visuais de `components/ui/` (Button, Input, Table, ScrollArea, Dialog, etc.) DEVEM ser reaproveitados sem duplicação.
- **FR-028**: Componentes de layout (`PageContainer`, `PageHeader`, `PageTitle`, `PageDescription`) DEVEM ser reaproveitados sem duplicação.
- **FR-029**: Componentes de feature específicos de Narradores (`narrators-client`, `narrators-table`, `narrator-row`, `narrator-new-row`, `delete-narrator-dialog`) DEVEM ser **duplicados** como `editors-client`, `editors-table`, `editor-row`, `editor-new-row`, `delete-editor-dialog` — a generalização seria mais custosa que a duplicação segundo a orientação explícita do produto, e ainda mais considerando que Editor possui um campo a mais (e-mail) que Narrador.
- **FR-030**: Domínio, repository, service, factory, errors e rotas de API DEVEM ser duplicados para Editor espelhando a estrutura atual de Narrador; não há tentativa de abstração genérica `SimpleNamedEntity<T>` nesta feature.
- **FR-031**: Testes (unit, integration, E2E) DEVEM ser duplicados espelhando a estrutura atual de Narrador, ajustando nomes de rotas, factories, campos (adicionar `email`) e mensagens.

### Key Entities

- **Editor**: Pessoa responsável pela edição e revisão dos capítulos de audiobooks; recebe pagamento por horas de edição em capítulos atribuídos. Atributos: identificador único, nome (obrigatório, 2-100 caracteres, **único após `trim`, case-sensitive**), e-mail (obrigatório, formato válido, até 255 caracteres, **único após `trim` e normalização para minúsculas**), timestamps (`created_at`, `updated_at`). Não referencia outras entidades nesta feature — capítulos referenciarão editores em feature futura, seguindo o mesmo modelo do narrador.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O produtor consegue criar, editar e excluir editores em menos de 10 segundos por operação (equivalente a Narradores pós-017).
- **SC-002**: Todas as operações CRUD (criar, ler, editar, excluir) funcionam corretamente e persistem no banco de dados.
- **SC-003**: A validação de campos impede 100% das submissões com dados inválidos (nome vazio, nome com tamanho inválido, nome duplicado, e-mail vazio, e-mail com formato inválido, e-mail duplicado).
- **SC-004**: O modal de exclusão previne exclusões acidentais — nenhum editor é excluído sem confirmação explícita.
- **SC-005**: O ícone de exclusão é visualmente distinguível da cor primária em todas as 5 variantes de cor primária da aplicação (blue, orange, green, red, amber).
- **SC-006**: A tabela funciona corretamente nas 3 opções de tamanho de fonte (small, medium, large) sem quebra de layout.
- **SC-007**: A página funciona corretamente em modo claro e escuro.
- **SC-008**: Tentar criar ou editar um editor com `name` duplicado (após `trim`, case-sensitive) retorna `409 NAME_ALREADY_IN_USE` em 100% dos casos e a UI exibe a mensagem "Nome já cadastrado" no campo "Nome".
- **SC-009**: Tentar criar ou editar um editor com `email` duplicado (após `trim` e lowercasing) retorna `409 EMAIL_ALREADY_IN_USE` em 100% dos casos e a UI exibe a mensagem "E-mail já cadastrado" no campo "E-mail".
- **SC-010**: `bun run lint`, `bun run test:unit`, `bun run test:integration`, `bun run test:e2e` e `bun run build` terminam sem erros nem warnings após a feature.
- **SC-011**: Cobertura de testes da feature ≥ 80% (unit + integration combinados) nos módulos de domínio, service, repository e controllers, consistente com o padrão da constituição.

## Assumptions

- A entidade Editor **ainda não existe** no banco de dados — esta feature cria a tabela `editor` via migração Drizzle reversível (`generate` + `migrate`). A estrutura é `id`, `name`, `email`, timestamps, com **dois índices únicos**: `editor_name_unique` em `name` (case-sensitive, sem normalização) e `editor_email_unique` em `email` (sobre o valor já normalizado — lowercased + trimmed — pelo service antes de persistir).
- A decisão de **manter e-mail em Editor** (em contraste com a remoção em Narrador na feature 017) se justifica pelo fluxo operacional: editores recebem pagamentos e comunicações formais relacionadas a prestação de serviços; narradores, no momento atual, não. Se o fluxo de Narrador mudar no futuro, uma feature específica reintroduzirá o campo.
- **Normalização de e-mail no service, não no schema Drizzle** — o service aplica `trim()` + `toLowerCase()` em `create` e `update` antes de chamar o repository. O índice único é aplicado ao valor já normalizado armazenado na coluna, simplificando a migração (sem expressão funcional).
- O relacionamento entre editor e capítulos (FK em `chapter.editor_id`) **está fora do escopo** desta feature — será implementado quando a entidade capítulo for criada. A constraint de "não excluir editor vinculado a capítulos em andamento" será adicionada nessa feature futura; por enquanto, a exclusão é livre (análogo ao estado atual de Narrador).
- A página `/editors` já está listada como `favoritePage` válida no schema `user_preference` — a rota apenas passa a existir fisicamente nesta feature.
- A duplicação de UI, domínio e testes entre Narrador e Editor é **aceita explicitamente** pelo produto — consolidação em abstração genérica é explicitamente desencorajada para manter acoplamento baixo e clareza alta entre entidades que já divergem (Editor tem campo `email`, Narrador não) e podem divergir ainda mais no futuro (editor pode ganhar campos próprios como valor-hora individual).
- O design visual segue a referência de `design.pen` (seção "07 - Editores" ou equivalente) e o padrão já implementado em `/narrators` pós-017; nenhuma nova variante visual é criada.
- Apenas usuários autenticados têm acesso à página e às APIs de editores — mesmo middleware e guards já aplicados a `/narrators`.
- Volume esperado de editores é baixo (dezenas, não centenas) — tabela não precisa de paginação.
- O formulário inline utiliza React Hook Form com validação Zod, mesmo stack técnica de Narradores.
- A tabela utiliza TanStack Table (via shadcn/ui DataTable) com sorting client-side — mesma stack técnica de Narradores.
- O seed de desenvolvimento (`seed.ts`) passa a criar alguns editores de exemplo para facilitar QA manual; `seed-test.ts` permanece intocado conforme regra de projeto.
