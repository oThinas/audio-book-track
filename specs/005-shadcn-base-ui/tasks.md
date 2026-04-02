# Tasks: Migrar shadcn/ui de Radix para Base UI

**Input**: Design documents from `/specs/005-shadcn-base-ui/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, quickstart.md

**Tests**: Nao ha testes especificos a gerar — esta feature e uma migracao de dependencias que sera validada pelo build e testes existentes.

**Organization**: Tasks organizadas por user story para permitir implementacao e teste independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Preparar o ambiente para a migracao de Radix para Base UI

- [x] T001 Atualizar shadcn CLI para versao que suporta Base UI via `bunx shadcn@latest --version` e verificar suporte a `--base base`
- [x] T002 Criar backup dos componentes atuais listando diffs pre-migracao via branch git

**Checkpoint**: Ambiente preparado para migracao

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Atualizar configuracao do shadcn e dependencias do projeto — DEVE ser concluido antes de qualquer migracao de componente

- [x] T003 Reinicializar shadcn com Base UI executando `bunx shadcn@latest init --base base --preset nova --reinstall` para atualizar components.json
- [x] T004 Remover dependencia `radix-ui` do package.json via `bun remove radix-ui`
- [x] T005 Dependencia `@base-ui/react` adicionada automaticamente pelo shadcn init
- [x] T006 Verificar que components.json usa `base-nova` como style (confirmado)

**Checkpoint**: Configuracao atualizada, dependencias trocadas — componentes podem ser migrados

---

## Phase 3: User Story 1 - Componentes UI migrados para Base UI (Priority: P1)

**Goal**: Todos os 5 componentes existentes em `src/components/ui/` funcionam com Base UI em vez de Radix

**Independent Test**: Executar `bun run build` sem erros e verificar que `grep -r "radix-ui" src/components/ui/` retorna vazio

### Implementation for User Story 1

- [x] T007 [P] [US1] Regenerar button.tsx via shadcn init --reinstall em src/components/ui/button.tsx
- [x] T008 [P] [US1] Regenerar label.tsx via shadcn init --reinstall em src/components/ui/label.tsx
- [x] T009 [P] [US1] Regenerar card.tsx via shadcn init --reinstall em src/components/ui/card.tsx
- [x] T010 [P] [US1] Regenerar input.tsx via shadcn init --reinstall em src/components/ui/input.tsx
- [x] T011 [US1] Verificar que sonner.tsx em src/components/ui/sonner.tsx nao tem imports de radix-ui (confirmado)
- [x] T012 [US1] Verificar que nao ha imports residuais de `radix-ui` ou `@radix-ui` em todo o projeto (zero matches)
- [x] T013 [US1] Executar `bun run build` — compilacao bem-sucedida
- [x] T014 [US1] Executar `bun run test:unit` — 19/19 testes passaram

**Checkpoint**: Todos os componentes migrados, build passa, testes passam

---

## Phase 4: User Story 2 - Novos componentes via CLI usam Base UI (Priority: P2)

**Goal**: Novos componentes adicionados via CLI do shadcn geram codigo com primitivos Base UI automaticamente

**Independent Test**: Adicionar um componente de teste (ex: dialog) via CLI e verificar que usa Base UI

### Implementation for User Story 2

- [x] T015 [US2] Verificar que components.json tem configuracao `base-nova` para Base UI (confirmado)
- [x] T016 [US2] Testado adicionando dialog via CLI — importa de `@base-ui/react/dialog` (confirmado)
- [x] T017 [US2] Removido componente de teste dialog

**Checkpoint**: CLI gera componentes Base UI por padrao

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validacao final e limpeza

- [x] T018 Verificar que `radix-ui` nao aparece em package.json (confirmado zero matches)
- [x] T019 Executar `bun run lint:fix` e `bun run lint` — sem erros
- [ ] T020 Executar verificacao visual da pagina de login conforme quickstart.md
- [ ] T021 Verificar bundle size comparando com estado anterior (deve ser igual ou menor)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sem dependencias — pode comecar imediatamente
- **Foundational (Phase 2)**: Depende de Setup (T001-T002) — BLOQUEIA todas as user stories
- **User Story 1 (Phase 3)**: Depende de Foundational (T003-T006)
- **User Story 2 (Phase 4)**: Depende de User Story 1 (verificar configuracao pos-migracao)
- **Polish (Phase 5)**: Depende de todas as user stories

### User Story Dependencies

- **User Story 1 (P1)**: Pode iniciar apos Phase 2. Sem dependencia de US2.
- **User Story 2 (P2)**: Depende de US1 estar completa (configuracao deve estar correta para testar CLI).

### Within Each User Story

- T007-T010 podem rodar em paralelo (arquivos diferentes)
- T011-T012 sao verificacoes pos-regeneracao
- T013-T014 sao validacoes finais sequenciais

### Parallel Opportunities

```bash
# Regenerar componentes em paralelo (Phase 3):
Task: "Regenerar button.tsx via npx shadcn@latest add button --overwrite"
Task: "Regenerar label.tsx via npx shadcn@latest add label --overwrite"
Task: "Regenerar card.tsx via npx shadcn@latest add card --overwrite"
Task: "Regenerar input.tsx via npx shadcn@latest add input --overwrite"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (atualizar config + deps)
3. Complete Phase 3: User Story 1 (regenerar componentes)
4. **STOP and VALIDATE**: Build + testes passam, zero imports Radix
5. Deploy/demo se pronto

### Incremental Delivery

1. Setup + Foundational → Config atualizada
2. User Story 1 → Componentes migrados → Build OK (MVP!)
3. User Story 2 → CLI validado para futuro → Config OK
4. Polish → Verificacao visual + bundle size

---

## Notes

- [P] tasks = arquivos diferentes, sem dependencias entre si
- [Story] label mapeia task para user story especifica
- Esta migracao nao afeta o modelo de dados nem a logica de negocio
- Sonner nao depende de Radix — apenas verificar, nao regenerar
- Commit apos cada phase para facilitar rollback se necessario