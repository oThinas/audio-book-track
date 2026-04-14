# Feature Specification: Verificacao de Acessibilidade nos Testes E2E

**Feature Branch**: `011-e2e-accessibility`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "Adicionar @axe-core/playwright nos testes E2E para verificar acessibilidade (contraste, ARIA, roles) automaticamente em cada PR — mais rapido e estavel que Lighthouse no CI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Deteccao automatica de violacoes de acessibilidade (Priority: P1)

Como desenvolvedor, ao executar a suite de testes E2E, quero que cada pagina testada seja automaticamente verificada quanto a violacoes de acessibilidade (contraste, ARIA, roles). As violacoes devem ser reportadas com detalhes suficientes para eu corrigir o problema sem pesquisa adicional.

**Why this priority**: Este e o valor central da feature — sem a verificacao automatica, nenhuma outra funcionalidade faz sentido. Garante que problemas de acessibilidade sejam detectados antes de chegar a producao.

**Independent Test**: Pode ser testado executando a suite E2E contra a aplicacao e verificando que violacoes conhecidas (ex: contraste insuficiente, labels ARIA ausentes) sao detectadas e reportadas com elemento afetado, regra violada e nivel de impacto.

**Acceptance Scenarios**:

1. **Given** a suite de testes E2E esta configurada com verificacao de acessibilidade, **When** um desenvolvedor executa `bun run test:e2e`, **Then** um test file dedicado de acessibilidade executa a verificacao em todas as paginas cobertas, independentemente dos testes funcionais.
2. **Given** uma pagina contem uma violacao de contraste (ex: texto cinza claro sobre fundo branco), **When** a verificacao de acessibilidade roda nessa pagina, **Then** a violacao e reportada com: elemento afetado, regra violada, nivel de impacto (critical/serious/moderate/minor) e sugestao de correcao.
3. **Given** uma pagina nao contem violacoes de acessibilidade, **When** a verificacao de acessibilidade roda nessa pagina, **Then** o teste passa sem erros.
4. **Given** a aplicacao suporta 2 temas (light, dark) e 5 cores primarias (blue, orange, green, red, amber), **When** a verificacao de acessibilidade roda em paginas autenticadas, **Then** todas as 10 combinacoes (2 temas x 5 cores) sao verificadas.
5. **Given** uma violacao de contraste existe apenas na combinacao "red + dark mode", **When** a verificacao roda todas as combinacoes, **Then** a violacao e detectada e o report indica exatamente qual combinacao de tema e cor causou a falha.

---

### User Story 2 - Bloqueio no CI para violacoes criticas (Priority: P2)

Como mantenedor do projeto, quero que o pipeline de CI falhe quando violacoes de acessibilidade com impacto "critical" ou "serious" forem detectadas, garantindo que PRs com problemas graves de acessibilidade nao sejam mergeados.

**Why this priority**: Acessibilidade so e efetiva se for enforced — sem bloqueio no CI, os reports seriam ignorados ao longo do tempo.

**Independent Test**: Pode ser testado introduzindo uma violacao "serious" intencional em uma pagina e verificando que o teste E2E falha no CI.

**Acceptance Scenarios**:

1. **Given** um PR contem uma pagina com violacao de impacto "critical", **When** o CI executa os testes E2E, **Then** o pipeline falha e o report indica a violacao especifica.
2. **Given** um PR contem apenas violacoes de impacto "moderate" ou "minor", **When** o CI executa os testes E2E, **Then** o pipeline passa (violacoes sao reportadas como warnings, nao como falhas).
3. **Given** um PR nao contem violacoes de acessibilidade, **When** o CI executa os testes E2E, **Then** o pipeline passa normalmente.

---

### User Story 3 - Utility reutilizavel para verificacao de acessibilidade (Priority: P3)

Como desenvolvedor escrevendo novos testes E2E, quero uma funcao utilitaria simples que eu possa chamar em qualquer teste para verificar acessibilidade da pagina atual, sem precisar configurar nada manualmente.

**Why this priority**: Facilita a adocao — se for simples adicionar a verificacao, novos testes ja nascem com cobertura de acessibilidade.

**Independent Test**: Pode ser testado criando um novo teste E2E basico e verificando que basta chamar a funcao utilitaria para obter verificacao de acessibilidade completa.

**Acceptance Scenarios**:

1. **Given** um novo teste E2E esta sendo escrito, **When** o desenvolvedor importa e chama a funcao utilitaria de acessibilidade, **Then** a verificacao e executada na pagina atual sem configuracao adicional.
2. **Given** a funcao utilitaria e chamada em um teste, **When** ela detecta violacoes, **Then** as violacoes sao formatadas de forma legivel no output do teste (elemento, regra, impacto, fix sugerido).
3. **Given** a funcao utilitaria e chamada em um teste de pagina autenticada, **When** o desenvolvedor nao especifica combinacoes, **Then** a verificacao roda automaticamente em todas as 10 combinacoes de tema e cor primaria.

---

### Edge Cases

- O que acontece quando uma pagina usa conteudo dinamico que carrega apos interacao do usuario? A verificacao deve rodar apos o conteudo estar visivel.
- Como o sistema lida com componentes em shadow DOM? A verificacao deve cobrir shadow roots se existirem.
- O que acontece quando a mesma violacao aparece em multiplos elementos? Cada ocorrencia deve ser reportada individualmente para facilitar a correcao.
- Como o sistema lida com falsos positivos? Deve existir um mecanismo para desabilitar regras especificas quando justificado.
- Como o sistema garante cobertura de todas as combinacoes de tema e cor primaria? A verificacao DEVE iterar sobre as 10 combinacoes (2 temas x 5 cores) em paginas autenticadas, pois violacoes de contraste podem existir apenas em combinacoes especificas (ex: "amber + light mode").
- O que acontece com paginas nao autenticadas (ex: login)? Paginas publicas nao possuem cor primaria customizavel — a verificacao deve rodar apenas nos 2 temas (light/dark) com a cor padrao.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE executar verificacao automatica de acessibilidade em um test file dedicado (`accessibility.spec.ts`), cobrindo todas as paginas testadas pela suite E2E, em todas as combinacoes de tema (light, dark) e cor primaria (blue, orange, green, red, amber) — totalizando 10 combinacoes para paginas autenticadas e 2 combinacoes (light, dark) para paginas publicas. Este test file opera independentemente dos testes funcionais existentes.
- **FR-002**: O sistema DEVE reportar violacoes com: elemento HTML afetado, regra WCAG violada, nivel de impacto (critical, serious, moderate, minor) e sugestao de correcao. Alem do output no console, DEVE capturar um screenshot da pagina no momento da violacao para facilitar depuracao visual (especialmente util para problemas de contraste).
- **FR-003**: O sistema DEVE falhar o teste quando violacoes de impacto "critical" ou "serious" forem detectadas.
- **FR-004**: O sistema DEVE permitir que violacoes de impacto "moderate" e "minor" sejam reportadas como warnings sem causar falha do teste.
- **FR-005**: O sistema DEVE fornecer uma funcao utilitaria reutilizavel que desenvolvedores possam usar em novos testes E2E.
- **FR-006**: O sistema DEVE permitir desabilitar regras especificas de acessibilidade por teste ou globalmente quando houver justificativa documentada (ex: componente de terceiro sem controle).
- **FR-007**: O sistema DEVE verificar conformidade com WCAG 2.1 nivel AA como baseline.
- **FR-008**: O sistema DEVE funcionar no CI sem dependencias externas alem do browser ja configurado (Chromium).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% das paginas cobertas pelos testes E2E existentes passam por verificacao automatica de acessibilidade em todas as combinacoes de tema e cor primaria (10 combinacoes para paginas autenticadas, 2 para publicas) em cada execucao.
- **SC-002**: Violacoes de impacto "critical" ou "serious" impedem o merge de PRs via falha no CI.
- **SC-003**: O tempo adicional por teste causado pela verificacao de acessibilidade e inferior a 2 segundos por combinacao de tema/cor por pagina.
- **SC-004**: Novos testes E2E podem adicionar verificacao de acessibilidade com no maximo 2 linhas de codigo.
- **SC-005**: Zero violacoes de acessibilidade de impacto "critical" ou "serious" nas paginas existentes, em todas as 10 combinacoes de tema/cor, apos a implementacao (corrigidas ou justificadas com regra desabilitada).

## Clarifications

### Session 2026-04-13

- Q: A matriz de 10 combinacoes (tema x cor) deve ser integrada nos testes E2E existentes ou executada em um test file dedicado? → A: Test file dedicado — um `accessibility.spec.ts` separado que navega cada pagina e roda a matriz de 10 combinacoes independentemente dos testes funcionais.
- Q: A verificacao de acessibilidade deve rodar em multiplos viewports (320, 768, 1024, 1440) ou apenas no viewport padrao? → A: Apenas viewport padrao (1280x720). Cobertura de viewports adicionais fica para fase futura.
- Q: Quando violacoes sao detectadas, o sistema deve gerar artefatos alem do output no console? → A: Console + screenshot da pagina no momento da violacao, capturando o estado visual que causou a falha.
- Q: A utility `checkAccessibility` deve iterar internamente sobre as 10 combinacoes tema/cor, ou o consumidor deve fazer o loop manualmente? → A: A utility itera internamente — o consumidor chama uma unica funcao e todas as combinacoes sao verificadas automaticamente. Isso garante integracao em 2 linhas (SC-004).

## Assumptions

- A infraestrutura de testes E2E existente (Playwright + Chromium) sera reutilizada sem modificacoes na configuracao base.
- WCAG 2.1 nivel AA e o padrao de conformidade adequado para esta aplicacao.
- O CI atual (que ja executa os testes E2E) suporta a execucao da verificacao de acessibilidade sem configuracao adicional de infraestrutura.
- Violacoes existentes de impacto "moderate" ou "minor" serao tratadas em tarefas futuras, nao como parte desta feature.
- A verificacao de acessibilidade roda apenas no viewport padrao do Playwright (1280x720). Cobertura de viewports responsivos (mobile, tablet) e escopo de fase futura.
- A verificacao cobre o DOM renderizado no momento da execucao; conteudo carregado sob demanda (lazy load) precisa ter o teste posicionado no estado correto antes da verificacao.
- A verificacao de acessibilidade DEVE iterar sobre todas as combinacoes de tema (light, dark) e cor primaria (blue, orange, green, red, amber) automaticamente. Para paginas publicas (ex: login), apenas os 2 temas sao variados (cor primaria nao se aplica).
- A opcao "system" de tema e equivalente a light ou dark conforme o OS — nao precisa ser testada como combinacao separada.