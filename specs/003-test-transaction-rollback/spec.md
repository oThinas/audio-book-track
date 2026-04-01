# Feature Specification: Transaction Rollback para Testes de Integração

**Feature Branch**: `003-test-transaction-rollback`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "Implementar transaction rollback para testes de integração, garantindo banco de dados fresco a cada teste tanto localmente quanto no CI/CD"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Isolamento de dados entre testes de integração (Priority: P1)

Como desenvolvedor, quero que cada teste de integração rode dentro de uma transação que é revertida automaticamente ao final, para que nenhum dado persista entre testes e eles possam ser executados em qualquer ordem sem interferência.

**Why this priority**: Sem isolamento por teste, resultados são não-determinísticos — testes passam ou falham dependendo da ordem de execução, dificultando debugging e gerando falsos positivos/negativos.

**Independent Test**: Pode ser verificado executando dois testes que inserem o mesmo registro com constraint unique — se ambos passam, o rollback está funcionando.

**Acceptance Scenarios**:

1. **Given** um teste de integração que insere um usuário no banco, **When** o teste termina (sucesso ou falha), **Then** o usuário inserido não existe para o próximo teste.
2. **Given** dois testes que inserem registros com o mesmo email (unique constraint), **When** ambos executam sequencialmente, **Then** ambos passam sem erro de violação de constraint.
3. **Given** um teste que falha com exceção no meio da execução, **When** o próximo teste roda, **Then** o banco está no estado limpo (dados parciais do teste anterior não persistem).

---

### User Story 2 - Paridade de comportamento entre ambiente local e CI/CD (Priority: P1)

Como desenvolvedor, quero que o mecanismo de isolamento de testes funcione de forma idêntica tanto no ambiente local quanto no pipeline de CI/CD, para que testes que passam localmente também passem no CI e vice-versa.

**Why this priority**: Divergência entre ambientes é uma das principais causas de "funciona na minha máquina" — mesma prioridade que o isolamento em si, pois um sem o outro não tem valor.

**Independent Test**: Pode ser verificado rodando a mesma suite de testes localmente e no CI e comparando resultados — ambos devem ter 100% de paridade.

**Acceptance Scenarios**:

1. **Given** o mecanismo de transaction rollback configurado, **When** os testes de integração rodam no CI/CD, **Then** o comportamento de isolamento é idêntico ao ambiente local.
2. **Given** um novo teste de integração escrito por um desenvolvedor, **When** ele segue o padrão estabelecido (sem configuração extra), **Then** o teste automaticamente herda o isolamento por transação.

---

### User Story 3 - Experiência simples para escrever novos testes (Priority: P2)

Como desenvolvedor, quero que o mecanismo de transaction rollback seja transparente e automático, para que eu não precise adicionar boilerplate de setup/teardown manualmente em cada arquivo de teste.

**Why this priority**: Se o mecanismo exige configuração manual por arquivo, desenvolvedores vão esquecer ou fazer errado, comprometendo o isolamento.

**Independent Test**: Pode ser verificado criando um novo arquivo de teste de integração e confirmando que ele herda o isolamento automaticamente sem nenhuma configuração adicional.

**Acceptance Scenarios**:

1. **Given** a infraestrutura de transaction rollback configurada, **When** um desenvolvedor cria um novo arquivo de teste de integração, **Then** ele precisa apenas importar o helper de banco e escrever seus testes — o rollback acontece automaticamente.
2. **Given** um teste de integração existente, **When** o desenvolvedor adiciona um novo `test()` / `it()` no mesmo arquivo, **Then** o novo teste tem isolamento independente dos outros no mesmo arquivo.

---

### Edge Cases

- O que acontece quando um teste faz operações em múltiplas tabelas dentro da mesma transação?
  - Todas as operações são revertidas — a transação envolve todas as queries do teste.
- O que acontece se o código sob teste executa `BEGIN`/`COMMIT` explicitamente?
  - Savepoints devem ser usados para que commits internos não escapem a transação de rollback do teste. Caso o ORM não faça commits explícitos (como é o caso atual com Drizzle), isso não é problema.
- O que acontece se um teste cria dados via HTTP request para a API (não diretamente via DB)?
  - Testes de integração existentes que usam HTTP serão migrados para acesso direto ao banco via services/repositories, eliminando esse cenário. Novos testes de integração devem seguir o mesmo padrão (acesso direto, sem HTTP).
- O que acontece se o pool de conexões se esgota durante os testes?
  - O mecanismo deve reutilizar uma única conexão por teste (não o pool inteiro), minimizando uso de conexões.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema de testes DEVE envolver cada teste de integração em uma transação de banco de dados que é revertida (rollback) ao final do teste.
- **FR-002**: O rollback DEVE ocorrer independentemente de o teste passar ou falhar.
- **FR-003**: O mecanismo DEVE ser automático — testes novos herdam o comportamento sem configuração manual por arquivo.
- **FR-004**: O mecanismo DEVE funcionar de forma idêntica em ambiente local e no pipeline de CI/CD.
- **FR-005**: O mecanismo DEVE isolar cada `test()` / `it()` individualmente, não apenas cada arquivo de teste.
- **FR-006**: O mecanismo DEVE ser compatível com os testes de integração existentes sem exigir reescrita significativa.
- **FR-007**: O mecanismo NÃO DEVE interferir com testes unitários ou testes E2E (que são mockados).
- **FR-008**: O mecanismo DEVE fornecer acesso ao banco de dados dentro do teste via helper/utilitário compartilhado, eliminando a necessidade de cada teste criar sua própria conexão.
- **FR-009**: O sistema DEVE fornecer factories/helpers para criação de dados de teste (ex: criar usuário), permitindo que cada teste seja auto-contido sem depender de seed global.

### Key Entities

- **Transação de teste**: Unidade de isolamento — uma transação de banco aberta antes de cada teste e revertida após, garantindo que nenhuma mutação persista.
- **Helper de banco para testes**: Utilitário compartilhado que fornece a conexão/transação ativa para os testes, abstraindo o ciclo de vida da transação.
- **Factory de dados de teste**: Helpers que criam entidades (usuário, sessão, etc.) dentro da transação do teste, tornando cada teste auto-contido.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes de integração passam quando executados em qualquer ordem (shuffle/random order).
- **SC-002**: Dois testes que inserem o mesmo registro com constraint unique passam sem erro quando executados sequencialmente.
- **SC-003**: Resultados dos testes são idênticos entre ambiente local e CI/CD — mesmos testes passam e falham em ambos.
- **SC-004**: Um novo teste de integração herda o isolamento com no máximo uma linha de setup adicional (import do helper).
- **SC-005**: O tempo total de execução dos testes de integração não aumenta mais que 10% em relação ao tempo atual.

## Clarifications

### Session 2026-04-01

- Q: Como testes HTTP-based (que usam conexão própria da API) devem ser tratados em relação ao transaction rollback? → A: Migrar testes existentes de HTTP para acesso direto ao banco (via Drizzle ORM / better-auth internal API), permitindo que o rollback cubra tudo.
- Q: Como testes que precisam de dados pré-existentes (ex: usuário admin) devem obter esses dados? → A: Cada teste cria seus próprios dados via factory/helper dentro da transação, sem dependência de seed global.
- Q: Testes de integração devem executar em paralelo ou sequencialmente? → A: Paralelo entre arquivos, sequencial dentro de cada arquivo (padrão do Vitest).

## Assumptions

- Os testes de integração existentes usam Drizzle ORM, que não faz `COMMIT` explícito nas operações padrão — portanto, transaction rollback funciona sem savepoints.
- Testes de integração existentes que usam HTTP serão migrados para acesso direto ao banco (via services/repositories), garantindo que o transaction rollback cubra todas as operações.
- O framework de testes é Vitest, que suporta hooks `beforeEach` / `afterEach` globais ou por arquivo.
- O banco de dados é PostgreSQL, que suporta transações aninhadas via savepoints.
- Não há testes que dependam de dados persistidos por testes anteriores (se houver, precisam ser corrigidos).
- Execução de testes segue o padrão do Vitest: arquivos em paralelo, testes dentro de cada arquivo em sequência. Cada teste obtém sua própria transação/conexão.
- O seed global (`db:seed`) não será mais necessário para testes de integração — cada teste cria seus próprios dados via factories.