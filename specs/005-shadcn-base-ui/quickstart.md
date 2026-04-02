# Quickstart: Migrar shadcn/ui de Radix para Base UI

## Pre-requisitos

- Bun instalado
- Projeto `audio-book-track` clonado e na branch `005-shadcn-base-ui`
- Dependencias instaladas (`bun install`)

## Passos da Migracao

### 1. Reinicializar shadcn com Base UI

```bash
npx shadcn@latest init --base base-ui
```

Isso atualiza `components.json` para usar Base UI como camada de primitivos.

### 2. Atualizar dependencias

```bash
bun remove radix-ui
bun add @base-ui-components/react
```

### 3. Regenerar componentes

```bash
npx shadcn@latest add button card input label --overwrite
```

> **Nota**: `sonner` nao precisa ser regenerado pois nao depende de Radix.

### 4. Verificar que nao ha imports Radix residuais

```bash
grep -r "@radix-ui\|from \"radix-ui\"" src/components/ui/
```

Deve retornar vazio.

### 5. Verificar build

```bash
bun run build
```

### 6. Executar testes

```bash
bun run test
```

## Verificacao Visual

Apos a migracao, abrir a aplicacao e verificar:
- [ ] Pagina de login renderiza corretamente (usa Button, Input, Label, Card)
- [ ] Toast notifications funcionam (Sonner)
- [ ] Nenhum erro no console do browser