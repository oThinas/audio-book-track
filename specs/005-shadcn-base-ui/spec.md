# Feature Specification: Migrar shadcn/ui de Radix para Base UI

**Feature Branch**: `005-shadcn-base-ui`  
**Created**: 2026-04-01  
**Status**: Draft  
**Input**: User description: "garantir que shadcn/ui use base ui, não radix;"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Componentes UI migrados para Base UI (Priority: P1)

Como desenvolvedor do projeto, quero que todos os componentes shadcn/ui existentes utilizem Base UI como camada de primitivos em vez de Radix UI, para que o projeto esteja alinhado com a direção oficial do shadcn/ui e se beneficie de menor tamanho de bundle e melhor performance.

**Why this priority**: Base UI é a nova fundação recomendada pelo shadcn/ui. Manter Radix cria divida tecnica crescente e incompatibilidade com futuras atualizacoes de componentes.

**Independent Test**: Reinstalar os componentes existentes (button, card, input, label, sonner) via CLI do shadcn e confirmar que nenhuma dependencia `@radix-ui/*` permanece no projeto. Verificar que a aplicacao renderiza corretamente.

**Acceptance Scenarios**:

1. **Given** o projeto com componentes shadcn/ui baseados em Radix, **When** a migracao e concluida, **Then** nenhum pacote `@radix-ui/*` ou `radix-ui` consta nas dependencias do projeto.
2. **Given** componentes migrados para Base UI, **When** o desenvolvedor executa a aplicacao, **Then** todos os componentes renderizam e se comportam identicamente ao estado anterior.
3. **Given** a configuracao do shadcn (`components.json`), **When** inspecionada apos migracao, **Then** o estilo configurado e compativel com Base UI (nao mais `radix-nova`).

---

### User Story 2 - Novos componentes adicionados via CLI usam Base UI (Priority: P2)

Como desenvolvedor, quero que ao executar `npx shadcn@latest add <componente>`, o componente gerado utilize Base UI automaticamente, sem necessidade de ajuste manual.

**Why this priority**: Garante que a migracao nao seja apenas pontual, mas que o pipeline de adicao de componentes esteja corretamente configurado para o futuro.

**Independent Test**: Executar o CLI do shadcn para adicionar um componente novo e verificar que o codigo gerado importa de primitivos Base UI e nao de `@radix-ui/*`.

**Acceptance Scenarios**:

1. **Given** `components.json` configurado para Base UI, **When** um novo componente e adicionado via CLI, **Then** o componente usa primitivos Base UI.
2. **Given** um novo componente adicionado, **When** o desenvolvedor inspeciona suas importacoes, **Then** nao ha referencia a `@radix-ui`.

---

### Edge Cases

- O que acontece se um componente shadcn/ui ainda nao tiver versao Base UI disponivel? Deve ser documentado e mantido temporariamente com Radix ate que a versao Base UI esteja disponivel.
- Como lidar com customizacoes locais feitas nos componentes existentes durante a migracao? As customizacoes devem ser preservadas e reaplicadas sobre os novos primitivos.
- E se a versao atual do shadcn CLI nao suportar Base UI? A versao do CLI deve ser atualizada antes da migracao.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE substituir todas as dependencias `@radix-ui/*` e `radix-ui` por equivalentes Base UI.
- **FR-002**: O arquivo `components.json` DEVE ser atualizado para usar o estilo Base UI em vez de `radix-nova`.
- **FR-003**: Todos os componentes existentes em `src/components/ui/` (button, card, input, label, sonner) DEVEM ser regenerados ou atualizados para usar primitivos Base UI.
- **FR-004**: O comportamento visual e funcional de cada componente DEVE permanecer identico apos a migracao.
- **FR-005**: Customizacoes locais nos componentes (se houver) DEVEM ser preservadas durante a migracao.
- **FR-006**: O CLI do shadcn DEVE estar na versao que suporta Base UI antes da migracao.

### Key Entities

- **Componente UI**: Primitivo visual reutilizavel em `src/components/ui/`. Atributos-chave: nome, dependencias de primitivos, customizacoes locais.
- **Configuracao shadcn** (`components.json`): Define estilo, aliases e comportamento do CLI para geracao de componentes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero dependencias `@radix-ui/*` ou `radix-ui` presentes no `package.json` apos a migracao.
- **SC-002**: 100% dos componentes existentes (5 componentes) renderizam corretamente apos a migracao, sem regressao visual.
- **SC-003**: Novos componentes adicionados via CLI geram codigo com primitivos Base UI automaticamente.
- **SC-004**: Tamanho do bundle do cliente nao aumenta em relacao ao estado anterior (idealmente reduz).

## Assumptions

- O shadcn CLI na versao mais recente suporta Base UI como alternativa a Radix.
- Os 5 componentes atuais (button, card, input, label, sonner) possuem equivalentes Base UI no registry do shadcn.
- Nao ha customizacoes profundas nos componentes atuais que impedam a regeneracao direta.
- O projeto ja utiliza a versao mais recente do Next.js (16.2), compativel com Base UI.
- A migracao nao afeta a logica de negocio ou testes existentes, apenas a camada de primitivos visuais.