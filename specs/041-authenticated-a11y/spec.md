# Feature Specification: Acessibilidade → A11y 100 nas páginas autenticadas (D1)

**Feature Branch**: `041-authenticated-a11y`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Sessão 2 do roadmap de remediação 2026-06 (docs/diagnostics/2026-06-remediation-plan.md): Acessibilidade → A11y 100 nas páginas autenticadas (D1). Corrigir as auditorias de acessibilidade reprovadas pelo Lighthouse (A11y = 96) em /dashboard, /books e /books/:id: color-contrast, label-content-name-mismatch, td-has-header e os erros de 'Role missing required ARIA props' do React Doctor nos comboboxes dos diálogos de livro."

## Overview

As páginas **autenticadas** auditadas na baseline 2026-06 pontuam **A11y = 96** no
Lighthouse (`/dashboard`, `/books`, `/books/:id`); apenas `/login` chega a 100. Há lacunas
**reais** de acessibilidade, corroboradas pelos erros estáticos do React Doctor. Esta sessão
eleva essas três páginas a **A11y = 100** corrigindo quatro classes de achado, cada uma
entregável de forma independente:

- **Contraste de cor (`color-contrast`):** texto/ícone secundário não atinge a razão mínima
  de contraste (4.5:1) sobre o fundo. A análise dos tokens OKLCH mostra que o problema é
  essencialmente de **tema claro** — no tema escuro o texto atenuado já passa folgado. Fix via
  token **global** `--muted-foreground`, concentrado no claro, validado nos dois temas.
- **Nome acessível ≠ texto visível (`label-content-name-mismatch`):** controles cujo nome
  acessível (definido por `aria-label`) não contém o texto visível, impedindo usuários de
  comando por voz de acioná-los pelo rótulo que enxergam.
- **Célula sem header associado (`td-has-header`):** células de dados da tabela de capítulos
  (em `/books/:id`) não estão programaticamente associadas ao seu cabeçalho de coluna,
  prejudicando o anúncio por leitores de tela.
- **Role sem ARIA props obrigatórias:** o gatilho de seleção de estúdio (`role="combobox"`)
  nos diálogos de criação e edição de livro não declara `aria-haspopup`/`aria-controls`.

**Estratégia de verificação (decidida no grill — ver §"Estratégia de verificação"):** o
**Lighthouse** (`bun run diagnose:lighthouse` → A11y = 100) é o **gate de aceitação**; a suíte
**`@axe-core/playwright` ampliada** (com nova cobertura de `/books` e `/books/:id`) mais
**asserções dirigidas** é o **driver de TDD/CI**. **Nenhuma** mudança de banco, schema,
repositório, service ou modelo de domínio — feature puramente de apresentação/acessibilidade.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Contraste de cor adequado (Priority: P1)

Usuários com baixa visão (e qualquer usuário em ambientes de luz adversa) precisam que todo
texto e ícone informativo seja legível. Hoje o Lighthouse reprova `color-contrast` em
`/dashboard`, `/books` e `/books/:id` (mobile e desktop), porque texto secundário/atenuado
não atinge a razão mínima de 4.5:1 sobre seu fundo. O objetivo é ajustar o token de contraste
reprovado (`--muted-foreground`, **global**, concentrado no **tema claro** — o escuro já
satisfaz o mínimo) de modo que todo texto atinja o mínimo WCAG AA, **validando os dois temas**
e preservando a distinção visual entre texto primário e secundário.

**Why this priority**: É a classe de achado de maior alcance — reprova nas **três** páginas,
em **ambos** os perfis (mobile/desktop). Contraste é um bloqueio WCAG AA "duro" (impacto axe
`serious`) e o item que mais pesa para sair de 96. Independente das demais histórias.

**Independent Test**: Re-rodar a auditoria de acessibilidade nas três páginas e confirmar
que a verificação `color-contrast` passa, e que a checagem de contraste do axe não reporta
violações — em tema claro e escuro — sem depender das demais histórias.

**Acceptance Scenarios**:

1. **Given** uma página autenticada auditada em **tema claro**, **When** a auditoria de
   acessibilidade avalia contraste, **Then** todo texto/ícone informativo atinge a razão
   mínima (≥ 4.5:1 para texto normal; ≥ 3:1 para texto grande/UI) e a verificação
   `color-contrast` passa.
2. **Given** a mesma página em **tema escuro**, **When** a auditoria avalia contraste,
   **Then** a verificação `color-contrast` continua passando (sem regressão — o escuro não é
   alterado).
3. **Given** o ajuste do token global, **When** se inspeciona a UI, **Then** texto secundário
   (atenuado) permanece visualmente distinguível do texto primário (não vira a mesma cor).
4. **Given** a baseline de scores, **When** as páginas são reauditadas, **Then** nenhuma
   outra categoria (Performance, Boas Práticas, SEO) regride, nem as demais suítes axe
   existentes (`/settings`, narrators/editors/studios) — o token global só **melhora** o
   contraste.

---

### User Story 2 - Combobox com ARIA completo nos diálogos de livro (Priority: P2)

Usuários de leitor de tela e de teclado precisam que o seletor de estúdio dos diálogos de
**criação** e **edição** de livro seja anunciado corretamente como um combobox: o leitor de
tela deve saber que o controle abre um popup e a qual elemento esse popup corresponde. Hoje o
gatilho declara `role="combobox"` e `aria-expanded`, mas **falta** `aria-haspopup` e
`aria-controls`, o que o React Doctor sinaliza como "Role missing required ARIA props".

**Why this priority**: É o erro de acessibilidade de topo do React Doctor (×2) e afeta um
fluxo central (cadastro/edição de livro) para usuários de tecnologia assistiva. Independente
das demais histórias.

**Independent Test**: Abrir os diálogos de criação e edição de livro e confirmar, via inspeção
de acessibilidade, que o gatilho anuncia corretamente o papel de combobox com a relação ao
popup; e re-rodar o diagnóstico estático confirmando zero "Role missing required ARIA props" —
sem depender das demais histórias.

**Acceptance Scenarios**:

1. **Given** o diálogo de criação de livro aberto, **When** o foco chega ao seletor de
   estúdio, **Then** a tecnologia assistiva o anuncia como combobox que abre um popup do tipo
   listbox e a qual popup ele se refere.
2. **Given** o diálogo de edição de livro aberto, **When** o foco chega ao seletor de
   estúdio, **Then** o mesmo anúncio correto ocorre, sem semântica ARIA conflitante/duplicada
   pela estrutura aninhada de dica (tooltip) + popup.
3. **Given** o diagnóstico estático de saúde de código é executado, **When** ele varre os
   componentes, **Then** nenhum achado "Role missing required ARIA props" é reportado para
   esses gatilhos.
4. **Given** o seletor de estúdio, **When** operado por teclado e por mouse, **Then** o
   comportamento de abrir/selecionar/fechar permanece idêntico ao atual, **sem** introduzir
   nova violação axe (ex.: `aria-valid-attr-value` por `aria-controls` apontando para id
   inexistente quando o popover está fechado).

---

### User Story 3 - Tabela de capítulos com células associadas a cabeçalhos (Priority: P3)

Usuários de leitor de tela navegando a tabela de capítulos em `/books/:id` precisam ouvir, em
cada célula, a qual coluna ela pertence. Hoje o Lighthouse reprova `td-has-header` nessa
página porque células de dados não estão associadas a um cabeçalho de coluna — suspeitos
principais: a coluna de arraste (`<th aria-hidden>` vazio) e as células das linhas de grupo.

**Why this priority**: Restrito a uma página (`/books/:id`) e a uma tabela específica, mas
essencial para a compreensão da tabela por leitor de tela. Independente das demais histórias.

**Independent Test**: Reauditar `/books/:id` e confirmar que a verificação `td-has-header`
passa, e que a asserção dirigida sobre a tabela não reporta violação de associação
célula↔cabeçalho — sem depender das demais histórias.

**Acceptance Scenarios**:

1. **Given** a tabela de capítulos renderizada em `/books/:id`, **When** a auditoria avalia a
   estrutura da tabela, **Then** toda célula de dados está programaticamente associada ao seu
   cabeçalho de coluna e `td-has-header` passa.
2. **Given** um leitor de tela navegando célula a célula, **When** o cursor entra numa
   célula, **Then** o cabeçalho da coluna correspondente é anunciado.
3. **Given** a coluna de arraste (reorder), hoje sem rótulo perceptível, **When** auditada,
   **Then** ela tem um cabeçalho real com texto `sr-only` (ex.: "Reordenar"), não mais
   `aria-hidden`.

---

### User Story 4 - Nome acessível contém o texto visível (Priority: P4)

Usuários de comando por voz precisam acionar um controle pelo texto que enxergam. Hoje o
Lighthouse reprova `label-content-name-mismatch` em `/dashboard` e `/books/:id`, em controles
cujo nome acessível (via `aria-label`) não inclui o rótulo visível.

**Why this priority**: Afeta duas páginas e um conjunto menor de controles; é o achado de
menor alcance da sessão, mas necessário para chegar a 100. Independente das demais histórias.

**Independent Test**: Reauditar `/dashboard` e `/books/:id` e confirmar que
`label-content-name-mismatch` passa para todos os controles — sem depender das demais
histórias.

**Acceptance Scenarios**:

1. **Given** um controle com texto visível e nome acessível conflitante, **When** removemos o
   `aria-label` que sobrescreve, **Then** o nome acessível passa a ser o próprio texto visível
   e `label-content-name-mismatch` passa.
2. **Given** um botão apenas com ícone (sem texto visível), **When** auditado, **Then** ele
   continua tendo um nome acessível adequado (a regra de "mismatch" não se aplica a controles
   sem texto visível).
3. **Given** os controles ajustados, **When** acionados por voz pelo rótulo visível, **Then**
   a ação ocorre como esperado.
4. **Given** a mudança dos nomes acessíveis, **When** os testes são executados, **Then** os
   seletores `getByRole(..., { name })` afetados (e2e/unit) foram atualizados e passam.

---

### Edge Cases

- **Contraste é problema de tema claro (US1):** o tema escuro já passa (`--muted-foreground`
  L 0.708 → 5.8–7.6:1); o claro reprova em superfícies tingidas (`muted`/`secondary`/`accent`,
  L 0.97 → ~4.34:1). O fix não pode quebrar o escuro nem tornar o texto atenuado
  indistinguível do primário.
- **Mesma superfície, fundos diferentes (US1):** texto atenuado aparece sobre background,
  muted, card; o contraste precisa passar em **todos** os fundos onde o token é usado.
- **Contraste preso a cor primária (US1):** o helper axe itera 5 cores primárias; se o
  discovery-run achar um contraste `serious` ligado a uma cor específica (que o Lighthouse, em
  cor única, não vê), ele é corrigido também — **sem** desabilitar combinações para fugir do
  RED.
- **Id pendurado no combobox (US2):** `aria-controls` deve apontar ao popover **apenas quando
  aberto** (o popover é renderizado condicionalmente); apontar para id inexistente quando
  fechado criaria `aria-valid-attr-value`.
- **Aninhamento tooltip + popup (US2):** no diálogo de edição há `TooltipTrigger →
  PopoverTrigger → Button`; a correção de ARIA não pode gerar IDs duplicados nem `aria-*`
  conflitantes; ids distintos para create vs edit.
- **`td-has-header` é `moderate` (US3):** o helper axe global só reprova `critical`/`serious`,
  então essa regra **não** falha por ele — exige **asserção dirigida** (não relaxar o helper
  global).
- **`role="button"` na linha de grupo (US3):** é mantido (mudá-lo é comportamental, território
  da Sessão 4, e quebra seletores `getByRole`); a correção resolve os `td` órfãos sem removê-lo.
- **Botão só-ícone vs. botão com texto (US4):** a correção vale para controles **com** texto
  visível; botões só-ícone seguem outra regra (têm nome acessível, mas não há texto visível
  para conter).
- **Sem regressão de baseline (todas):** as correções não podem piorar Performance, Boas
  Práticas ou SEO das páginas auditadas.
- **Arquivos compartilhados com a Sessão 4:** `book-create-dialog.tsx`, `book-edit-dialog.tsx`
  e `mobile-sidebar.tsx` também são tocados pela Sessão 4 (D4/D5). Esta sessão mexe **apenas**
  em props ARIA/contraste; coordenação sequencial evita rebase (ver Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

#### Contraste de cor (color-contrast)

- **FR-001**: Todo texto e ícone informativo das páginas autenticadas auditadas
  (`/dashboard`, `/books`, `/books/:id`) DEVE atingir a razão mínima de contraste WCAG AA
  (≥ 4.5:1 para texto normal; ≥ 3:1 para texto grande e componentes de interface) sobre o seu
  fundo, em **ambos** os temas.
- **FR-002**: O ajuste DEVE ser feito no **token global** `--muted-foreground` (sem override
  pontual nem cor hardcoded), com a alteração concentrada no **tema claro** (o escuro já
  satisfaz o mínimo e não é alterado), validado nos dois temas.
- **FR-003**: O ajuste de contraste NÃO DEVE regredir nenhuma outra categoria do Lighthouse
  nas páginas auditadas, nem as demais suítes axe existentes.

#### Combobox com ARIA obrigatório

- **FR-004**: O gatilho `role="combobox"` (seletor de estúdio nos diálogos de criação e
  edição de livro) DEVE declarar `aria-haspopup="listbox"` e `aria-controls` referenciando o
  popup, este último vinculado **apenas quando o popover está aberto** (id estável no
  `PopoverContent`).
- **FR-005**: O diagnóstico estático de saúde de código NÃO DEVE reportar achado "Role
  missing required ARIA props" para esses controles.
- **FR-006**: A correção NÃO DEVE introduzir nova violação axe (ex.: `aria-valid-attr-value`)
  nem semântica ARIA conflitante/IDs duplicados na estrutura aninhada tooltip + popup.
- **FR-007**: O comportamento interativo dos seletores (abrir/selecionar/fechar, por teclado e
  mouse) DEVE permanecer idêntico ao atual; correção aplicada **in-place nos dois diálogos**,
  sem extrair componente compartilhado.

#### Associação célula↔cabeçalho na tabela de capítulos

- **FR-008**: Toda célula de dados da tabela de capítulos em `/books/:id` DEVE estar
  programaticamente associada ao seu cabeçalho de coluna, de modo que `td-has-header` passe.
- **FR-009**: Todos os `<th>` DEVEM declarar `scope="col"`; a coluna de arraste (reorder) DEVE
  ter um cabeçalho real com texto `sr-only` em vez de `aria-hidden`. O `role="button"` da linha
  de grupo é **mantido**.

#### Nome acessível ↔ texto visível

- **FR-010**: Controles com texto visível e nome acessível conflitante DEVEM ter o `aria-label`
  sobrescrito **removido**, deixando o texto visível ser o nome acessível (`sr-only` interno
  apenas onde faltar contexto real). Alvos confirmados: `period-filter` (dashboard),
  `book-pdf-popover` e a linha de grupo de capítulos (`/books/:id`).

#### Verificação

- **FR-011**: O audit de acessibilidade do Lighthouse DEVE reportar **A11y = 100** em
  `/dashboard`, `/books` e `/books/:id`, em perfil mobile e desktop (gate de aceitação).
- **FR-012**: DEVE existir cobertura `@axe-core/playwright` para `/books` e `/books/:id` (nova
  `books-accessibility.spec.ts`, mesmo helper de 10 combinações tema×cor); todas as suítes
  `*-accessibility.spec.ts` DEVEM permanecer verdes.
- **FR-013**: Regras que o helper axe global não reprova por impacto (`td-has-header` =
  `moderate`) ou não detecta (props ARIA do combobox) DEVEM ser cobertas por **asserções
  dirigidas** — sem relaxar o corte `critical`/`serious` do helper global.

### Key Entities

Nenhuma — esta feature não envolve dados, schema nem modelo de domínio. As "entidades"
afetadas são superfícies de UI (páginas e componentes) e tokens de design.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: O score de A11y do Lighthouse é **100** em `/dashboard`, `/books` e
  `/books/:id`, em perfil mobile **e** desktop (gate de aceitação).
- **SC-002**: O diagnóstico estático (`react-doctor --verbose`) reporta **zero** achados de
  "Role missing required ARIA props" nos seletores dos diálogos de livro.
- **SC-003**: Todas as suítes `*-accessibility.spec.ts` (`@axe-core/playwright`), **incluindo
  a nova `books-accessibility.spec.ts`** que cobre `/books` e `/books/:id`, passam com **zero**
  violações `critical`/`serious` nas 10 combinações tema×cor.
- **SC-004**: As verificações `color-contrast`, `label-content-name-mismatch` e
  `td-has-header` do Lighthouse passam nas páginas em que hoje reprovam, e as asserções
  dirigidas (FR-013) passam.
- **SC-005**: O contraste passa em **ambos** os temas (claro e escuro) nas páginas auditadas.
- **SC-006**: Nenhuma regressão nas demais categorias do Lighthouse (Performance, Boas
  Práticas, SEO) nas páginas auditadas, comparado à baseline 2026-06.
- **SC-007**: O comportamento funcional dos controles ajustados (seletor de estúdio, tabela de
  capítulos, botões de ação) é preservado — suítes unit/integration/e2e verdes.

## Estratégia de verificação

Decidida no grill de 2026-06-25. Duas camadas com papéis distintos:

- **Gate de aceitação — Lighthouse.** `bun run diagnose:lighthouse` deve reportar **A11y =
  100** nas três páginas (mobile + desktop). É a fonte que mede o que hoje reprova; roda
  **localmente** (precisa de DB em `localhost:5432`, build de produção e sessão de admin
  semeada, como na baseline). A queda de Best Practices local por 404 dos scripts Vercel
  **não** afeta a categoria A11y — logo é um gate confiável fora da Vercel.
- **Driver de TDD/CI — axe ampliado + asserções dirigidas.**
  - **Cobertura:** criar `__tests__/e2e/books-accessibility.spec.ts` cobrindo `/books` **e**
    `/books/:id` (hoje sem spec axe), seguindo o padrão dos `*-accessibility.spec.ts` e
    semeando livro + capítulos via factory. Reusa `checkAccessibility` (10 combinações
    tema×cor; reprova só `critical`/`serious`).
  - **Asserções dirigidas:** para `td-has-header` (impacto `moderate`, que o helper global
    deixa como warning) e para a relação ARIA do combobox (que o axe pode não flagar), adicionar
    asserções específicas (axe com `include`/`runOnly` no alvo, ou assert direto de atributos no
    DOM) que falham hoje e passam após o fix. **Não** relaxar o corte `critical`/`serious` do
    helper global.
  - **RED ancorado no discovery-run:** a 1ª task do plan roda Lighthouse + axe e enumera os
    elementos/tokens exatos que reprovam; só então os testes falhos são escritos e os fixes
    aplicados (RED → GREEN). Se o discovery achar contraste `serious` preso a uma cor primária
    específica, ele é corrigido também (mantendo a suíte honestamente verde), registrado como
    achado do discovery.

## Impacto em testes

- **Novo arquivo:** `__tests__/e2e/books-accessibility.spec.ts` (cobertura axe de `/books` e
  `/books/:id`).
- **Asserções dirigidas** para `td-has-header` e para os atributos ARIA do combobox.
- **Atualização de seletores:** a remoção de `aria-label` sobrescrito (US4) **muda os nomes
  acessíveis**; seletores `getByRole(..., { name })` em e2e/unit que casam com os labels atuais
  (ex.: "Editar URL do PDF", "Selecionar período customizado", "Expandir grupo") quebram e
  precisam ser atualizados. Trocas de DOM/role/name exigem rodar `bun run test:e2e`.
- **Reverificação por blast radius do token global:** após ajustar `--muted-foreground`,
  confirmar que as suítes axe existentes (`/settings`, narrators/editors/studios/dashboard)
  permanecem verdes (o ajuste só melhora o contraste, mas a verificação é obrigatória).

## Decisões resolvidas (grill 2026-06-25)

- **Verificação (Q1):** Lighthouse = gate de aceitação; axe ampliado + asserções dirigidas =
  driver de TDD/CI. Manter corte `critical`/`serious` do helper global.
- **Contraste (Q2):** (a) ajustar o **token global** `--muted-foreground`; (b) **só o tema
  claro** (validar ambos); (c) **discovery-run** como primeira task.
- **Combobox (Q3):** (a) `aria-haspopup="listbox"` + `aria-controls` vinculado só quando
  aberto (id no `PopoverContent`), confirmar via Context7; (b) fix **in-place** nos dois
  diálogos, **sem** extrair componente.
- **Tabela (Q4):** abordagem **cirúrgica** — `scope="col"` em todos os `<th>` + header
  `sr-only` na coluna de arraste + **manter** `role="button"` da linha de grupo; células
  exatas confirmadas no discovery-run.
- **Label mismatch (Q5):** filosofia **(A) consistente** — remover `aria-label` sobrescrito,
  texto visível vira o nome (+ `sr-only` onde faltar contexto); atualizar seletores.
- **Escopo da spec axe (Q6):** mesmo helper/10 combos na nova spec; RED ancorado no
  discovery-run; corrigir contraste cor-específico se aparecer (sem desabilitar combos);
  Lighthouse como gate manual local.

## Assumptions

- **Páginas em escopo:** apenas as autenticadas que hoje pontuam A11y = 96 — `/dashboard`,
  `/books`, `/books/:id`. `/login` já está em 100 e não é tocado.
- **Sem mudança de domínio/dados:** nenhuma alteração de banco, schema, repositório, service
  ou modelo de domínio; feature puramente de apresentação/acessibilidade.
- **Token suspeito principal confirmado por cálculo:** `--muted-foreground` (claro L 0.556 →
  ~4.34:1 sobre superfícies tingidas L 0.97; escuro L 0.708 já passa). O conjunto **exato** de
  elementos/tokens e os novos valores saem do discovery-run no `/speckit-plan` (os `file:line`
  da baseline são hipóteses iniciais).
- **Combobox shadcn:** o padrão ARIA correto (props e referência ao popup) será confirmado via
  **Context7** (shadcn/Radix Combobox + WAI-ARIA APG) no plan.
- **Coordenação com a Sessão 4 (D4/D5):** `book-create-dialog.tsx`, `book-edit-dialog.tsx` e
  `mobile-sidebar.tsx` são compartilhados. Esta sessão altera **só** ARIA/contraste; as
  sessões devem rodar **sequencialmente** (nunca em branches paralelas) para evitar rebase.
- **Ambiente de verificação:** o diagnóstico roda contra build de produção com sessão de admin
  semeada (`bun run build && bun run start` + `diagnose:seed`), idêntico ao da baseline 2026-06.
- **Ordem de implementação sugerida:** discovery-run → US1 contraste → US2 combobox → US3
  tabela → US4 label, mas cada história é independente.

## Dependencies

- Scripts de diagnóstico existentes (`scripts/diagnostics/*`), driver do Lighthouse e
  `bun run diagnose` (seed + lighthouse + react).
- Suítes `@axe-core/playwright` existentes (`__tests__/e2e/accessibility.spec.ts`, os
  `*-accessibility.spec.ts` por entidade e o helper `__tests__/e2e/helpers/accessibility.ts`)
  como rede de segurança de runtime.
- Sistema de tokens de design em `src/app/globals.css` (tokens OKLCH para os dois temas).
- Primitivos shadcn/ui de combobox/popover e de tabela já em uso.

## Out of Scope

- Os demais itens do backlog da baseline 2026-06: D2/D3 (performance mobile / CWV) e D4/D5
  (React Compiler / effects) — cobertos pelas Sessões 3 e 4 (042–043).
- Os ~173 warnings de manutenibilidade do React Doctor não itemizados no backlog §6.
- A categoria experimental `agentic-browsing` do Lighthouse 13.
- Correções de acessibilidade em `/login` (já em A11y = 100) e em páginas não auditadas na
  baseline.
- Refatoração de effects/closures dos arquivos compartilhados (pertence à Sessão 4).
- Extração de um componente `StudioCombobox` compartilhado (follow-up, fora do escopo de a11y).
- Mudar o `role="button"` da linha de grupo da tabela (comportamental — Sessão 4).
