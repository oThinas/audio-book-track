# Data Model: Migrar shadcn/ui de Radix para Base UI

## Entidades Afetadas

Esta feature nao altera o modelo de dados do dominio. Nenhuma entidade de banco de dados e afetada.

## Artefatos de Configuracao

### components.json

| Campo | Valor Atual | Valor Apos Migracao |
|-------|-------------|---------------------|
| `style` | `"radix-nova"` | Estilo compativel com Base UI (definido pelo CLI) |
| `rsc` | `true` | `true` (sem mudanca) |
| `tsx` | `true` | `true` (sem mudanca) |
| `iconLibrary` | `"lucide"` | `"lucide"` (sem mudanca) |

### package.json (dependencias)

| Dependencia | Acao |
|-------------|------|
| `radix-ui` v1.4.3 | REMOVER |
| `@base-ui-components/react` | ADICIONAR (versao latest) |

### Componentes UI

| Componente | Usa Radix? | Acao |
|------------|-----------|------|
| `button.tsx` | Sim (`Slot`) | Regenerar com Base UI |
| `label.tsx` | Sim (`Label`) | Regenerar com Base UI |
| `card.tsx` | Nao | Regenerar para consistencia |
| `input.tsx` | Nao | Regenerar para consistencia |
| `sonner.tsx` | Nao | Manter (depende de `sonner` lib, nao de primitivos) |

## State Transitions

N/A — esta feature nao envolve transicoes de estado.