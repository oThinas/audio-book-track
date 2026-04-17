# Feature Specification: CRUD de Narradores

**Feature Branch**: `015-narrators-crud`
**Created**: 2026-04-16
**Status**: Draft
**Input**: User description: "CRUD de Narradores — tabela editável inline com criação, edição e exclusão"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Listar narradores existentes (Priority: P1)

O produtor acessa a página de Narradores e visualiza uma tabela com todos os narradores cadastrados, contendo nome e e-mail. As colunas podem ser ordenadas clicando no cabeçalho.

**Why this priority**: Sem a listagem, nenhuma outra operação (criar, editar, excluir) é possível. É o alicerce de todas as demais funcionalidades.

**Independent Test**: Pode ser testada acessando a rota `/narrators` e verificando que a tabela renderiza com dados vindos do banco de dados.

**Acceptance Scenarios**:

1. **Given** existem 3 narradores cadastrados, **When** o produtor acessa `/narrators`, **Then** a tabela exibe 3 linhas com nome e e-mail de cada narrador.
2. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "Nome", **Then** as linhas são reordenadas alfabeticamente por nome (ascendente); clicando novamente, inverte para descendente.
3. **Given** a tabela está exibida, **When** o produtor clica no cabeçalho "E-mail", **Then** as linhas são reordenadas alfabeticamente por e-mail.
4. **Given** não existem narradores cadastrados, **When** o produtor acessa `/narrators`, **Then** a tabela exibe um estado vazio com mensagem indicando que não há narradores cadastrados.
5. **Given** a tabela possui registros, **When** o produtor visualiza a página, **Then** a tabela está envolvida em um ScrollArea que permite scroll vertical caso o conteúdo exceda a área visível.

---

### User Story 2 - Criar novo narrador (Priority: P1)

O produtor clica no botão "+ Novo Narrador" e uma nova linha editável aparece na tabela. Ele preenche nome e e-mail e confirma para criar o registro, ou cancela para descartar a linha.

**Why this priority**: Sem criação, o sistema não tem dados para operar. É co-fundamental com a listagem.

**Independent Test**: Clicar em "+ Novo Narrador", preencher campos e confirmar; verificar que o registro aparece na tabela e persiste no banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela de narradores está exibida, **When** o produtor clica em "+ Novo Narrador", **Then** uma nova linha aparece no topo da tabela com campos "Nome" e "E-mail" editáveis, e botões "Cancelar" e "Confirmar" substituem os ícones de ação.
2. **Given** uma nova linha está em modo de criação com campos preenchidos, **When** o produtor clica em "Confirmar", **Then** o registro é criado no banco de dados, a linha sai do modo editável e exibe os dados confirmados com ícones de "Editar" e "Excluir".
3. **Given** uma nova linha está em modo de criação, **When** o produtor clica em "Cancelar", **Then** a linha é removida da tabela sem criar nenhum registro.
4. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com o campo "Nome" vazio, **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com um e-mail inválido, **Then** uma mensagem de validação é exibida indicando que o formato do e-mail é inválido.
6. **Given** uma nova linha está em modo de criação, **When** o produtor tenta confirmar com um e-mail que já existe, **Then** uma mensagem de erro é exibida indicando que o e-mail já está cadastrado.

---

### User Story 3 - Editar narrador existente (Priority: P2)

O produtor clica no ícone de "Editar" em uma linha existente. Os campos de nome e e-mail se tornam editáveis. Ele pode confirmar as alterações ou cancelar para restaurar os valores anteriores.

**Why this priority**: Edição é essencial para corrigir dados, mas depende de dados já existentes (criação vem primeiro).

**Independent Test**: Clicar em "Editar" em uma linha, alterar valores, confirmar; verificar que os dados atualizados persistem.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um narrador "João Silva" com e-mail "joao@email.com", **When** o produtor clica no ícone de "Editar" dessa linha, **Then** os campos "Nome" e "E-mail" se tornam inputs editáveis com os valores atuais preenchidos, e os botões "Cancelar" e "Confirmar" substituem os ícones de "Editar" e "Excluir".
2. **Given** a linha está em modo de edição com nome alterado para "João Santos", **When** o produtor clica em "Confirmar", **Then** o registro é atualizado no banco de dados, a linha sai do modo de edição e exibe "João Santos".
3. **Given** a linha está em modo de edição com nome alterado, **When** o produtor clica em "Cancelar", **Then** os valores originais ("João Silva", "joao@email.com") são restaurados e a linha volta ao modo de visualização.
4. **Given** a linha está em modo de edição, **When** o produtor limpa o campo "Nome" e clica em "Confirmar", **Then** uma mensagem de validação é exibida indicando que o nome é obrigatório.
5. **Given** a linha está em modo de edição, **When** o produtor altera o e-mail para um já existente em outro narrador, **Then** uma mensagem de erro é exibida indicando que o e-mail já está cadastrado.

---

### User Story 4 - Excluir narrador (Priority: P2)

O produtor clica no ícone de "Excluir" e um modal de confirmação é exibido. Ele pode confirmar a exclusão ou cancelar.

**Why this priority**: Exclusão é necessária para manutenção de dados, mas é menos frequente que criação e edição.

**Independent Test**: Clicar em "Excluir", confirmar no modal; verificar que o registro é removido da tabela e do banco de dados.

**Acceptance Scenarios**:

1. **Given** a tabela exibe um narrador "João Silva", **When** o produtor clica no ícone de "Excluir" dessa linha, **Then** um modal de confirmação é exibido com a pergunta "Tem certeza que deseja excluir o narrador João Silva?" e botões "Cancelar" e "Excluir".
2. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Excluir", **Then** o registro é removido do banco de dados, o modal fecha e a linha desaparece da tabela.
3. **Given** o modal de confirmação está aberto, **When** o produtor clica em "Cancelar", **Then** o modal fecha e nenhuma alteração é feita.
4. **Given** o narrador está atribuído a capítulos cujo livro está em status ativo (pendente, em edição, em revisão ou edição retake), **When** o produtor tenta excluí-lo, **Then** uma mensagem de erro é exibida informando que o narrador não pode ser excluído porque está vinculado a capítulos em andamento.
5. **Given** o narrador está atribuído apenas a capítulos cujos livros estão em status "concluído" ou "pago", **When** o produtor confirma a exclusão, **Then** o narrador é excluído com sucesso pois os vínculos são apenas históricos.

---

### Edge Cases

- O que acontece quando o produtor clica em "+ Novo Narrador" enquanto já existe uma linha em modo de criação? A linha de criação pendente deve receber foco e nenhuma nova linha é adicionada.
- O que acontece quando o produtor tenta editar uma linha enquanto outra está em modo de edição? Ambas as edições coexistem — são operações independentes.
- O que acontece quando o produtor clica em "+ Novo Narrador" enquanto uma linha está em modo de edição? A criação de uma nova linha e a edição de outra coexistem — são operações independentes.
- O que acontece quando a requisição de criação/edição/exclusão falha por erro de rede? Um toast de erro é exibido com mensagem genérica e o estado da UI é revertido ao estado anterior à operação.
- O que acontece quando dois produtores editam o mesmo narrador simultaneamente? O último a confirmar sobrescreve (last-write-wins); se o registro foi excluído por outro usuário, um erro é exibido.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE exibir uma tabela com todos os narradores cadastrados, mostrando as colunas "Nome" e "E-mail".
- **FR-002**: O sistema DEVE permitir ordenação ascendente e descendente em todas as colunas da tabela.
- **FR-003**: O sistema DEVE permitir a criação de um novo narrador via linha editável inline na tabela, acionada pelo botão "+ Novo Narrador".
- **FR-004**: O sistema DEVE validar que o nome é obrigatório (mínimo 2 caracteres, máximo 100 caracteres) ao criar ou editar um narrador.
- **FR-005**: O sistema DEVE validar que o e-mail possui formato válido ao criar ou editar um narrador.
- **FR-006**: O sistema DEVE garantir unicidade do e-mail entre narradores, retornando erro `409` quando duplicado.
- **FR-007**: O sistema DEVE permitir edição inline dos campos nome e e-mail ao clicar no ícone de "Editar" de uma linha existente.
- **FR-008**: O sistema DEVE restaurar os valores originais quando o produtor cancela uma edição.
- **FR-009**: O sistema DEVE exibir um modal de confirmação antes de excluir um narrador.
- **FR-010**: O sistema DEVE impedir a exclusão de um narrador vinculado a capítulos cujo livro esteja em status ativo (pendente, em edição, em revisão ou edição retake), retornando erro `409` com mensagem explicativa. Narradores vinculados apenas a capítulos de livros em status "concluído" ou "pago" (histórico) podem ser excluídos normalmente.
- **FR-011**: O sistema DEVE permitir múltiplas operações simultâneas na tabela — edição de linhas existentes e criação de nova linha são ações independentes que coexistem.
- **FR-012**: O sistema DEVE envolver a tabela em um ScrollArea para suportar diferentes tamanhos de fonte sem quebrar o layout.
- **FR-013**: O sistema DEVE exibir um estado vazio com mensagem quando não houver narradores cadastrados.
- **FR-014**: O sistema DEVE exibir feedback via toast (sonner) apenas em caso de erro nas operações de criação, edição e exclusão.

### Regra de cor para ações destrutivas

- **FR-015**: O ícone de "Excluir" na tabela e o botão "Excluir" no modal de confirmação DEVEM usar uma cor de perigo dedicada (`destructive`) que seja visualmente distinta da cor primária da aplicação.
- **FR-016**: Quando a cor primária escolhida pelo usuário for a variante vermelha (rose), a cor de ações destrutivas DEVE ser ajustada para um tom mais escuro e saturado (ex: vermelho-escuro tendendo ao bordô/crimson) para manter contraste visual claro entre ações primárias e destrutivas.

### Key Entities

- **Narrador**: Pessoa responsável pela gravação dos capítulos de audiobooks. Atributos principais: identificador único, nome (obrigatório, 2-100 caracteres), e-mail (obrigatório, formato válido, único entre narradores). O e-mail é utilizado para compartilhamento de arquivos de gravação no Google Drive.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O produtor consegue criar, editar e excluir narradores em menos de 30 segundos por operação.
- **SC-002**: Todas as operações CRUD (criar, ler, editar, excluir) funcionam corretamente e persistem no banco de dados.
- **SC-003**: A validação de campos impede 100% das submissões com dados inválidos (nome vazio, e-mail malformado, e-mail duplicado).
- **SC-004**: O modal de exclusão previne exclusões acidentais — nenhum narrador é excluído sem confirmação explícita.
- **SC-005**: O ícone de exclusão é visualmente distinguível da cor primária em todas as 5 variantes de cor primária da aplicação (blue, orange, green, red, amber).
- **SC-006**: A tabela funciona corretamente nas 3 opções de tamanho de fonte (small, medium, large) sem quebra de layout.
- **SC-007**: A página funciona corretamente em modo claro e escuro.
- **SC-008**: O narrador vinculado a capítulos em andamento não pode ser excluído, com feedback claro ao produtor; narradores vinculados apenas a livros concluídos/pagos podem ser excluídos normalmente.

## Assumptions

- A entidade Narrador será criada no banco de dados com Drizzle ORM como parte desta feature — não existe tabela de narradores atualmente.
- A relação entre narrador e capítulos será via foreign key na tabela de capítulos, mas a tabela de capítulos pode não existir ainda. A constraint de "não excluir narrador vinculado a capítulos em andamento" (FR-010) será implementada quando a tabela de capítulos existir; por enquanto, a exclusão será livre. Nota adicionada em `futuras-features.md`.
- O e-mail do narrador é usado para compartilhamento no Google Drive, mas a integração com Google Drive está fora do escopo desta feature — apenas o campo é armazenado.
- A página de Narradores segue o mesmo padrão visual da página de Editores (07 - Editores no design.pen), adaptada para os campos do narrador.
- Apenas usuários autenticados têm acesso à página e às APIs de narradores.
- A tabela não necessita de paginação dado o volume esperado de registros (dezenas, não centenas).
- O token CSS `--destructive` já existe no sistema (definido em `globals.css`) e será reutilizado para ações destrutivas; o ajuste para o caso da cor primária vermelha será feito via CSS condicional em `html[data-primary-color="red"]` (valores específicos em `research.md` §3).
- O formulário inline utiliza React Hook Form com validação Zod, conforme padrão do projeto.
- A tabela utiliza TanStack Table (via shadcn/ui DataTable) com sorting client-side.
