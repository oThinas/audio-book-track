# Feature Specification: Refatorar Testes para Test Doubles Manuais

**Feature Branch**: `012-test-doubles-refactor`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "refatorar testes para preferir test doubles manuais (in-memory repositories, fakes) em vez de `vi.mock()`; manter `vi.mock()`/`vi.fn()` apenas para libs externas, efeitos colaterais (crypto, Date) e módulos fora do controle do projeto"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Desenvolvedores escrevem testes de serviço com fakes injetáveis (Priority: P1)

Quando um desenvolvedor cria ou modifica testes de unidade para services que dependem de repositories, ele utiliza implementações in-memory (fakes) em vez de `vi.mock()`. O service recebe o fake via construtor, e o teste exercita o comportamento real do service com dados controlados em memória — sem interceptação de módulos.

**Why this priority**: Services com injeção de dependência via construtor são o alvo principal da refatoração. Substituir `vi.mock()` por fakes nestes casos elimina acoplamento ao caminho de importação, torna os testes mais legíveis e garante que a lógica de orquestração é validada de forma realista.

**Independent Test**: Pode ser validado executando `bun run test:unit` e confirmando que todos os testes de services passam sem nenhum `vi.mock()` para módulos internos do projeto.

**Acceptance Scenarios**:

1. **Given** um teste de unidade de um service que hoje usa `vi.mock()` para mockar um repository interno, **When** a refatoração é aplicada, **Then** o teste passa a instanciar um fake in-memory do repository e injetá-lo via construtor, sem `vi.mock()`.
2. **Given** um teste de unidade de service refatorado, **When** o teste é executado, **Then** ele continua passando com o mesmo comportamento verificado anteriormente.
3. **Given** o conjunto completo de testes de unidade de services, **When** todos são executados, **Then** nenhum deles usa `vi.mock()` para módulos internos do projeto (apenas para libs externas ou efeitos colaterais).

---

### User Story 2 - Desenvolvedores escrevem testes de módulos internos com fakes de função (Priority: P2)

Quando um desenvolvedor testa módulos internos que dependem de funções do projeto (ex: `ping`, `health-check`), ele cria fakes tipados dessas funções em vez de usar `vi.mock()` para interceptar módulos. Se o módulo testado aceita a dependência como parâmetro (injeção de função), o fake é passado diretamente. Se não aceita, o módulo é refatorado para aceitar a dependência via parâmetro.

**Why this priority**: Módulos que usam `vi.mock()` para interceptar funções internas do projeto (ex: `@/lib/db/ping`) são o segundo maior grupo de mocks. Refatorá-los para aceitar dependências como parâmetro melhora testabilidade e elimina o acoplamento à estrutura de importação.

**Independent Test**: Pode ser validado executando `bun run test:unit` e confirmando que testes de módulos internos (ex: health check, instrumentation) não usam `vi.mock()` para funções do projeto.

**Acceptance Scenarios**:

1. **Given** um teste de unidade que usa `vi.mock("@/lib/db/ping")` para mockar uma função interna, **When** a refatoração é aplicada, **Then** o módulo testado aceita a função como parâmetro e o teste injeta um fake tipado.
2. **Given** um teste de unidade refatorado para injetar fakes de função, **When** ele é executado, **Then** o resultado é idêntico ao teste original (mesmos cenários cobertos, mesmos asserts).
3. **Given** um módulo do projeto que foi refatorado para aceitar dependências via parâmetro, **When** ele é usado em produção, **Then** o comportamento default (sem parâmetro passado) permanece inalterado.

---

### User Story 3 - Testes mantêm `vi.mock()` somente para módulos fora do controle do projeto (Priority: P3)

Desenvolvedores mantêm `vi.mock()` exclusivamente para: bibliotecas externas (ex: `next/headers`, `next/navigation`, `@axe-core/playwright`, `better-auth/cookies`), efeitos colaterais do sistema (crypto, Date, timers) e módulos de infraestrutura/ambiente não injetáveis (ex: `@/lib/env`, `@/lib/db`). `vi.fn()` é permitido livremente para criar fakes tipados que satisfazem uma interface ou type — a restrição aplica-se apenas a `vi.mock()` (interceptação de módulos internos). A distinção é documentada em uma convenção de testes.

**Why this priority**: Estabelecer e documentar a regra de quando `vi.mock()` é aceitável garante consistência futura e previne regressão para o padrão antigo.

**Independent Test**: Pode ser validado por uma revisão automatizada (grep ou lint rule) que verifica que todo `vi.mock()` restante referencia apenas módulos permitidos (lista allowlist).

**Acceptance Scenarios**:

1. **Given** o conjunto completo de testes de unidade após a refatoração, **When** um script analisa todos os `vi.mock()` restantes, **Then** cada um referencia apenas módulos da allowlist (libs externas, Next.js framework, efeitos colaterais, infraestrutura). Usos de `vi.fn()` para criar fakes tipados são permitidos sem restrição.
2. **Given** a convenção de testes documentada, **When** um novo desenvolvedor escreve um teste de unidade, **Then** ele sabe claramente quando usar fakes manuais e quando `vi.mock()` é aceitável.

---

### Edge Cases

- E se um módulo interno não puder ser refatorado para aceitar dependências via parâmetro sem uma mudança de assinatura pública significativa? Documentar como exceção justificada, com comentário no teste explicando o motivo.
- E se um fake in-memory divergir do comportamento real do repository (ex: constraint de unicidade)? Fakes devem implementar a interface do domínio e respeitar os contratos definidos nela; testes de integração continuam validando o comportamento real com banco de dados.
- E se o setup global de testes (`__tests__/unit/setup.ts`) mockear módulos usados indiretamente por muitos testes? Avaliar se o mock global pode ser removido ou movido para os testes específicos que realmente precisam dele.

## Clarifications

### Session 2026-04-14

- Q: `@/lib/db` deve entrar na allowlist de `vi.mock()` ou ser refatorado para injeção? → A: Allowlist — `@/lib/db` é infraestrutura de I/O (conexão singleton PostgreSQL), `vi.mock()` permitido assim como `@/lib/env`.
- Q: `vi.fn()` deve ser banido para criar fakes de funções internas, assim como `vi.mock()`? → A: Não — `vi.fn()` é permitido para criar fakes tipados que satisfazem uma interface/type. A restrição aplica-se apenas a `vi.mock()` (interceptação de módulos internos).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Testes de unidade de services DEVEM usar fakes in-memory (implementando a interface do repository) em vez de `vi.mock()` para dependências internas.
- **FR-002**: Módulos internos testados com `vi.mock()` para funções do projeto DEVEM ser refatorados para aceitar a dependência como parâmetro (injeção de função) e os testes DEVEM injetar fakes tipados.
- **FR-003**: `vi.mock()` DEVE ser mantido apenas para: (a) bibliotecas externas (`next/headers`, `next/navigation`, `@axe-core/playwright`, `better-auth/cookies`), (b) efeitos colaterais do sistema (crypto, Date, timers), (c) módulos de infraestrutura/ambiente não injetáveis (`@/lib/env`, `@/lib/db`).
- **FR-004**: Para cada repository interface existente no domínio, DEVE existir uma implementação in-memory correspondente em `__tests__/repositories/`.
- **FR-005**: Fakes in-memory DEVEM implementar a mesma interface TypeScript que a implementação concreta, garantindo type safety.
- **FR-006**: Refatorações em módulos de produção para aceitar injeção de dependência DEVEM manter o comportamento default inalterado (parâmetros opcionais com valor padrão).
- **FR-007**: O setup global de testes de unidade (`__tests__/unit/setup.ts`) DEVE ser revisado: mocks globais de módulos internos devem ser removidos ou movidos para os testes específicos.
- **FR-008**: Uma convenção de testes DEVE ser documentada descrevendo quando usar fakes manuais vs. `vi.mock()`.
- **FR-009**: Todos os testes existentes DEVEM continuar passando após a refatoração, com cobertura igual ou superior à atual.
- **FR-010**: `bun run lint` e `bun run build` DEVEM passar sem erros ou warnings após a refatoração.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% dos testes de unidade de services utilizam fakes in-memory em vez de `vi.mock()` para dependências internas.
- **SC-002**: Todos os `vi.mock()` restantes no codebase de testes de unidade referenciam exclusivamente módulos da allowlist (libs externas, framework Next.js, efeitos colaterais do sistema, módulos de ambiente).
- **SC-003**: Para cada interface de repository no domínio, existe uma implementação in-memory correspondente no diretório de testes.
- **SC-004**: Todos os testes de unidade, integração e build passam sem erros após a refatoração.
- **SC-005**: Cobertura de testes permanece igual ou superior ao nível pré-refatoração.
- **SC-006**: Uma convenção de testes está documentada e acessível para novos desenvolvedores.

## Assumptions

- A arquitetura atual já segue injeção de dependência via construtor para services — o padrão já existe com `UserPreferenceService` e `InMemoryUserPreferenceRepository`.
- Módulos internos que hoje são mockados via `vi.mock()` podem ser refatorados para aceitar dependências como parâmetro sem impacto na API pública (usando parâmetros opcionais com defaults).
- O `vi.mock("@/lib/db")` no setup global é herdado por todos os testes de unidade; sua remoção ou migração para testes específicos não quebrará testes que não dependem dele diretamente.
- A lista de módulos permitidos para `vi.mock()` cobre: `next/headers`, `next/navigation`, `@axe-core/playwright`, `better-auth/cookies`, `@/lib/env` e `@/lib/db` (infraestrutura de I/O). Novas libs externas e módulos de infraestrutura seguem o mesmo critério.
- Testes de integração e E2E não são afetados por esta refatoração — o escopo é exclusivamente testes de unidade.