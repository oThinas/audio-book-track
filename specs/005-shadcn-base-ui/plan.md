# Implementation Plan: Migrar shadcn/ui de Radix para Base UI

**Branch**: `005-shadcn-base-ui` | **Date**: 2026-04-01 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-shadcn-base-ui/spec.md`

## Summary

Migrar os componentes shadcn/ui do projeto de Radix UI (`radix-ui` v1.4.3) para Base UI (`@base-ui-components/react`), atualizando a configuracao do shadcn (`components.json`) e regenerando/atualizando os 5 componentes existentes (button, card, input, label, sonner).

## Technical Context

**Language/Version**: TypeScript 5.9 (Bun runtime)
**Primary Dependencies**: Next.js 16.2, React 19.2, shadcn v4.1.2, radix-ui v1.4.3 (a ser substituido por @base-ui-components/react)
**Storage**: PostgreSQL (nao afetado por esta feature)
**Testing**: Vitest (unit/integration), Playwright (E2E)
**Target Platform**: Web (Next.js App Router, SSR)
**Project Type**: Web application (Next.js)
**Performance Goals**: LCP < 1s (manter ou melhorar)
**Constraints**: Bundle size nao pode aumentar; comportamento visual identico pos-migracao
**Scale/Scope**: 5 componentes UI a migrar, 2 com dependencia direta de Radix

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Status | Notas |
|-----------|--------|-------|
| IV. Simplicidade Primeiro | PASS | Migracao direta, sem abstrações adicionais |
| VII. Frontend: shadcn/ui obrigatorio | PASS | Mantém shadcn/ui, apenas troca primitivos |
| VIII. Performance | PASS | Base UI tende a ser menor que Radix; bundle nao deve aumentar |
| IX. Design Tokens | PASS | Tokens CSS nao sao afetados; apenas primitivos mudam |
| XII. Anti-Padroes | PASS | Nenhum anti-padrao introduzido |

Nenhuma violacao detectada. Gate aprovado.

## Project Structure

### Documentation (this feature)

```text
specs/005-shadcn-base-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── components/
│   └── ui/              # Componentes afetados pela migracao
│       ├── button.tsx   # Usa Slot de radix-ui → migrar para base-ui
│       ├── label.tsx    # Usa Label de radix-ui → migrar para base-ui
│       ├── card.tsx     # Sem dependencia Radix (HTML puro)
│       ├── input.tsx    # Sem dependencia Radix (HTML puro)
│       └── sonner.tsx   # Sem dependencia Radix (usa sonner lib)
├── lib/
│   └── utils.ts         # cn() utility (nao afetado)
└── app/                 # Pages/Layouts (nao afetados)

components.json          # Configuracao shadcn (style a atualizar)
package.json             # Dependencias (radix-ui → @base-ui-components/react)
```

**Structure Decision**: Nenhuma mudanca estrutural. Os arquivos existentes em `src/components/ui/` serao atualizados in-place. Apenas `button.tsx` e `label.tsx` possuem imports de `radix-ui` que precisam ser substituidos.

## Complexity Tracking

> Nenhuma violacao da constituicao. Tabela vazia.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |