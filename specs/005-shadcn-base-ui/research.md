# Research: Migrar shadcn/ui de Radix para Base UI

## R1: Como o shadcn CLI suporta Base UI

**Decision**: Usar `npx shadcn@latest init --base base-ui` para reinicializar a configuracao do shadcn no projeto.

**Rationale**: A partir do shadcn v4+, o CLI suporta a flag `--base` durante o `init` para escolher entre `radix` (padrao) e `base-ui`. Isso atualiza o `components.json` para gerar componentes com primitivos Base UI. O pacote Base UI e `@base-ui-components/react`.

**Alternatives considered**:
- Migracao manual sem re-init: mais trabalhosa e propensa a erros na configuracao.
- Fork dos componentes: viola o principio VII (usar shadcn/ui, nao construir do zero).

## R2: Quais componentes precisam de migracao

**Decision**: Apenas `button.tsx` e `label.tsx` possuem imports diretos de `radix-ui`. Os demais (card, input, sonner) nao dependem de Radix.

**Rationale**: Analise do codigo-fonte revelou:
- `button.tsx`: importa `{ Slot } from "radix-ui"` para o padrao `asChild`.
- `label.tsx`: importa `{ Label as LabelPrimitive } from "radix-ui"` para o componente Label.
- `card.tsx`, `input.tsx`: HTML puro, sem dependencias externas.
- `sonner.tsx`: depende apenas da lib `sonner` e `next-themes`.

**Alternatives considered**:
- Regenerar todos os 5 componentes via CLI: mais seguro mas pode perder customizacoes.
- Migrar apenas os 2 afetados manualmente: mais preciso, preserva customizacoes existentes.

**Decision final**: Regenerar via CLI (para garantir alinhamento com o registry oficial) e reaplicar quaisquer customizacoes encontradas. Analise mostrou que os componentes atuais sao essencialmente stock shadcn sem customizacoes significativas.

## R3: Equivalentes Base UI para primitivos Radix utilizados

**Decision**: Usar `@base-ui-components/react` como substituto direto.

**Rationale**:
- `Slot` (Radix) → equivalente em Base UI para composicao de componentes.
- `Label` (Radix) → `@base-ui-components/react/label` ou equivalente nativo.
- Base UI e mantido pelo time do MUI e projetado como primitivos headless, similar ao Radix.

**Alternatives considered**:
- Remover primitivos e usar HTML nativo: possivel para Label, mas perde acessibilidade built-in.
- Manter Radix para componentes sem equivalente Base UI: fallback aceitavel se necessario.

## R4: Impacto no bundle size

**Decision**: Base UI deve resultar em bundle igual ou menor.

**Rationale**: Base UI foi projetado como alternativa leve ao Radix. O projeto usa apenas 2 primitivos Radix (Slot e Label), entao o impacto e minimo. A dependencia `radix-ui` (pacote unificado) inclui todos os primitivos mesmo quando poucos sao usados; `@base-ui-components/react` tem tree-shaking mais eficiente.

## R5: Estrategia de migracao

**Decision**: Abordagem em 3 passos:
1. Reinicializar shadcn com `--base base-ui` (atualiza `components.json`)
2. Substituir dependencia `radix-ui` por `@base-ui-components/react` no `package.json`
3. Regenerar componentes via `npx shadcn@latest add` e verificar diffs

**Rationale**: Esta abordagem e a mais segura e alinhada com o workflow oficial do shadcn. Regenerar componentes garante que o codigo gerado esteja correto para Base UI.

**Alternatives considered**:
- Editar imports manualmente: funciona mas nao garante que o codigo gerado esteja otimizado para Base UI.
- Criar novo projeto e copiar: overhead desnecessario para 5 componentes.