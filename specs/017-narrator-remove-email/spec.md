# Feature Specification: Remoção do campo e-mail de Narradores

**Feature Branch**: `017-narrator-remove-email`
**Created**: 2026-04-17
**Status**: Draft
**Input**: User description: "Narradores não terá mais o campo e-mail"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Gerenciar narradores apenas pelo nome (Priority: P1)

O produtor acessa a página de Narradores e visualiza uma tabela contendo apenas a coluna "Nome". Ele pode criar, editar e excluir narradores informando somente o nome — o campo e-mail deixa de existir na interface e no banco de dados.

**Why this priority**: É a totalidade da mudança. Sem este ajuste, o domínio continua inconsistente com a nova regra de negócio (narradores não precisam mais de e-mail para operação do sistema).

**Independent Test**: Acessar `/narrators`, verificar que a tabela exibe apenas a coluna "Nome", criar um narrador informando apenas o nome, editar e excluir — todas as operações funcionam sem qualquer referência a e-mail.

**Acceptance Scenarios**:

1. **Given** o produtor acessa `/narrators`, **When** a tabela carrega, **Then** apenas a coluna "Nome" é exibida (além da coluna de ações); não há coluna, header, ou valor de e-mail em lugar nenhum da página.
2. **Given** o produtor clica em "+ Novo Narrador", **When** a nova linha entra em modo de criação, **Then** apenas o campo "Nome" é renderizado como input editável; não há campo de e-mail.
3. **Given** o produtor preenche o nome "Ana Paula" e clica em "Confirmar", **When** a requisição é enviada, **Then** o narrador é criado no banco de dados com apenas `id`, `name`, `createdAt`, `updatedAt` — sem coluna `email`.
4. **Given** existem narradores previamente cadastrados (incluindo em bases de dev/produção), **When** a migração é aplicada, **Then** o campo `email` é removido da tabela sem perda de registros de narradores e sem quebra da aplicação.
5. **Given** o produtor clica em "Editar" em uma linha existente, **When** o modo de edição abre, **Then** apenas o campo "Nome" é editável; não há campo de e-mail carregado nem exibido.
6. **Given** o produtor confirma a edição do nome, **When** a requisição é enviada, **Then** apenas o campo `name` é persistido; o endpoint aceita payloads sem `email` sem retornar erro de validação.
7. **Given** já existe um narrador "Ana Paula", **When** o produtor tenta criar outro narrador com o nome "Ana Paula" (exatamente igual após `trim`), **Then** a criação falha com erro de conflito e mensagem de validação "Nome já cadastrado" é exibida no formulário.
8. **Given** já existe um narrador "Ana Paula" e outro "Bruno", **When** o produtor edita "Bruno" para renomeá-lo como "Ana Paula", **Then** a edição falha com erro de conflito e mensagem de validação "Nome já cadastrado" é exibida no formulário.
9. **Given** o produtor edita um narrador mantendo o mesmo nome (nenhuma mudança efetiva), **When** confirma, **Then** a operação é idempotente — a API aceita e o nome continua válido (não há falso positivo de conflito contra o próprio registro).

---

### Edge Cases

- O que acontece com a restrição de unicidade atual no e-mail? O índice único `narrator_email_unique` é removido junto com a coluna na migração.
- O que acontece com os valores de e-mail já cadastrados no banco (dev/test/prod)? São descartados junto com a coluna — a migração é destrutiva para esse campo. Não há requisito de preservação histórica do e-mail.
- O que acontece se um cliente antigo enviar `email` no payload de criação/edição? O campo é ignorado silenciosamente pelo schema Zod (não é erro de validação, apenas não é persistido).
- O que acontece com testes, fixtures, factories e seeds que hoje informam `email`? Todos são atualizados para deixar de informar o campo; seed-test permanece focado apenas no admin (não é tocado para narradores, conforme regra do projeto).
- O que acontece se a base pré-existente já tiver dois narradores com o mesmo `name` no momento da migração? A migração falha ao criar o índice único. Em dev, o usuário deve deduplicar manualmente antes de rodar `bun run db:migrate`. Em produção (quando existir), coordenação manual é necessária — fora do escopo automático desta feature (ver Assumptions).
- "Nome" é comparado como **texto exato após `trim`, case-sensitive**. "Ana" e "ana" são considerados diferentes. Acentos, espaços internos duplicados e capitalização fazem parte da chave — não há normalização automática além do trim nas pontas.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE remover a coluna `email` da tabela `narrator` no banco de dados via migração Drizzle reversível (`generate` + `migrate`).
- **FR-002**: O sistema DEVE remover o índice único `narrator_email_unique` como parte da mesma migração.
- **FR-003**: O sistema DEVE remover o campo `email` da entidade de domínio `Narrator` e de todos os schemas Zod associados (`narratorFormSchema`, `createNarratorSchema`, `updateNarratorSchema`).
- **FR-004**: O sistema DEVE remover o método `findByEmail` da interface de repository `NarratorRepository` e de sua implementação concreta `DrizzleNarratorRepository`, já que ele só existe para aplicar a validação de unicidade de e-mail — agora obsoleta.
- **FR-005**: O sistema DEVE remover a classe de erro `NarratorEmailAlreadyInUseError` e todas as suas ocorrências no service, controller e UI.
- **FR-006**: A API REST de narradores (`POST /api/v1/narrators`, `PATCH /api/v1/narrators/:id`) DEVE aceitar payloads contendo apenas `name` e DEVE ignorar qualquer campo `email` enviado sem retornar erro.
- **FR-007**: A tabela de narradores na UI DEVE exibir apenas a coluna "Nome" (além da coluna de ações), preservando ordenação ascendente/descendente por nome.
- **FR-008**: Os formulários inline de criação (`NarratorNewRow`) e edição (`NarratorRow`) DEVEM conter apenas o campo "Nome"; o input de e-mail, o label associado, a validação de unicidade e a mensagem de erro correlata DEVEM ser removidos.
- **FR-009**: O sistema DEVE atualizar toda a suíte de testes (unit, integration, E2E) e factories (`createTestNarrator`) para refletir a ausência do campo `email`.
- **FR-010**: O sistema DEVE atualizar o seed de desenvolvimento (`seed.ts`) para remover referências a e-mail de narradores; o seed de teste (`seed-test.ts`) permanece inalterado (não contém narradores).
- **FR-011**: A aplicação DEVE compilar (`bun run build`), passar no lint (`bun run lint`) e em todos os testes (unit, integration, E2E) após a remoção do campo.
- **FR-012**: A documentação relevante do projeto (`CLAUDE.md` tabela de domínio, `docs/`, quickstarts de features anteriores de narradores) DEVE ser atualizada para refletir que narrador não possui mais e-mail.
- **FR-013**: O sistema DEVE garantir unicidade do `name` entre narradores via índice único (`narrator_name_unique`) na tabela `narrator`. A mesma migração que remove `email`/`narrator_email_unique` DEVE criar `narrator_name_unique`.
- **FR-014**: O repository DEVE expor `findByName(name: string): Promise<Narrator | null>` (substituindo `findByEmail`) para suporte a validação e mensagens de erro amigáveis.
- **FR-015**: Violação da constraint de unicidade em `name` DEVE ser mapeada a um erro de domínio `NarratorNameAlreadyInUseError` (substituindo `NarratorEmailAlreadyInUseError`). A API REST DEVE responder `409` com código `NAME_ALREADY_IN_USE` tanto em `POST` quanto em `PATCH`.
- **FR-016**: A UI (formulário inline de criação e edição) DEVE exibir a mensagem "Nome já cadastrado" no campo "Nome" ao receber `409 NAME_ALREADY_IN_USE` da API, usando o mesmo mecanismo de `setError` do React Hook Form.
- **FR-017**: A comparação de unicidade DEVE ser **case-sensitive e apenas com `trim` nas pontas** — sem normalização adicional (sem lowercasing, sem collapse de espaços internos, sem remoção de acentos). Dois nomes que diferem apenas em capitalização são considerados diferentes.

### Key Entities

- **Narrador** (alterado): Pessoa responsável pela gravação dos capítulos de audiobooks. Atributos após esta feature: identificador único, nome (obrigatório, 2-100 caracteres, **único após `trim`, case-sensitive**), timestamps. O campo e-mail é **removido**; a unicidade que antes era garantida pelo e-mail passa a ser garantida pelo nome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A busca textual por `email` no código do domínio de narradores (`src/app/(authenticated)/narrators/**`, `src/lib/domain/narrator*.ts`, `src/lib/repositories/**/drizzle-narrator-repository.ts`, `src/app/api/v1/narrators/**`, `src/lib/errors/narrator-errors.ts`) retorna **zero ocorrências** após a feature.
- **SC-002**: A tabela `narrator` no banco não possui mais a coluna `email` nem o índice `narrator_email_unique` após `bun run db:migrate`.
- **SC-003**: O produtor completa a criação de um narrador em menos de 10 segundos (antes levava o tempo de digitar nome + e-mail).
- **SC-004**: 100% dos testes existentes de narradores continuam passando após a remoção do campo, sem qualquer asserção remanescente sobre `email`.
- **SC-005**: A página funciona corretamente em modo claro e escuro, nas 3 opções de tamanho de fonte (small, medium, large), e em viewports mobile e desktop — todas já cobertas por testes E2E atuais.
- **SC-006**: O `bun run build` de produção termina sem erros de TypeScript nem warnings de lint após a mudança.
- **SC-007**: Tentar criar ou editar um narrador com `name` duplicado (após `trim`, case-sensitive) retorna `409 NAME_ALREADY_IN_USE` em 100% dos casos, e a UI exibe a mensagem "Nome já cadastrado" no campo "Nome".

## Assumptions

- A remoção do e-mail é **definitiva** — não há requisito de preservação histórica (ex: coluna `deprecated_email`, export prévio, etc.). Se essa premissa for inválida, o usuário deve solicitar explicitamente uma etapa de migração prévia.
- Não existe integração externa (Google Drive, envio de convites, etc.) ativa no sistema que dependa do e-mail do narrador hoje — o campo existia apenas como preparação para futuro uso de compartilhamento de arquivos, conforme `015-narrators-crud/spec.md`. Essa preparação é abandonada por decisão de produto; qualquer integração futura que precise de contato do narrador será modelada como feature própria.
- Bases de dados produtivas (se existirem) aceitam migração destrutiva do campo sem backup prévio coordenado. Em ambiente dev/test, a migração pode ser aplicada livremente.
- Ambiente de testes E2E continua aplicando migrations automaticamente via `globalSetup` do Playwright — nenhuma mudança de infraestrutura de testes é necessária.
- Nenhum consumidor externo da API REST depende do campo `email` sendo retornado em respostas de narradores (a API ainda é interna).
- A base de dev (e de teste, após reset) não possui hoje dois narradores com o mesmo `name`. Caso possua, o desenvolvedor deduplica manualmente antes de aplicar a migração. Não há script automático de deduplicação.
- Case-sensitive em nomes é aceitável para o público do sistema (produtores brasileiros com nomes próprios). Se no futuro houver demanda por unicidade case-insensitive ou normalizada, será uma feature separada.
