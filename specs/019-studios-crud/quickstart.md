# Quickstart: CRUD de Estúdios

**Feature**: 019-studios-crud
**Date**: 2026-04-21

Como colocar a feature de pé localmente, entender o fluxo de UI e reusar o novo componente `MoneyInput` em outras features.

---

## 1. Aplicar a migração no banco de desenvolvimento

```fish
# 1. Gerar o SQL de migração a partir do schema Drizzle atualizado
bun run db:generate

# 2. Inspecionar o arquivo gerado em drizzle/0XXX_*.sql
#    Esperado: CREATE TABLE studio + CREATE UNIQUE INDEX studio_name_unique

# 3. Aplicar ao banco de dev (audiobook_track)
bun run db:migrate
```

**Confirmação rápida** (usando `psql` ou cliente de sua escolha):

```sql
\d studio
-- Deve listar 5 colunas: id, name, default_hourly_rate (numeric(10,2)), created_at, updated_at
-- E o índice único studio_name_unique em (name)
```

Se o banco já tiver sido inicializado em sessões anteriores e você quiser resetar:

```fish
bun run db:reset   # drop + recreate + apply all migrations
```

---

## 2. Rodar a aplicação

```fish
bun run dev
```

Acessar `http://localhost:3000/studios`. Como **não há seed de estúdios** (decisão registrada em research §R6), a tabela aparece vazia na primeira visita — o produtor cria o primeiro estúdio manualmente clicando em **"+ Novo Estúdio"**.

### Fluxo de criação manual

1. Clicar em **"+ Novo Estúdio"** — uma linha editável aparece no topo.
2. Digitar nome: ex. `Sonora Studio`.
3. No campo **Valor/hora** (cents-first), digitar `8500` → exibido como `R$ 85,00`.
4. Clicar em **Confirmar** → a linha persiste e passa a modo visualização.

Alterações no valor/hora de um estúdio **não** afetam livros já criados — apenas pré-preenchem o preço de novos livros criados após a alteração (ver spec FR-026).

---

## 3. Usando `MoneyInput` em outras features

O componente `src/components/ui/money-input.tsx` é **genérico** e será reutilizado na criação de Livros (FR-025a). Contrato público:

```typescript
import { MoneyInput } from "@/components/ui/money-input";
import { useState } from "react";

function Example() {
  const [value, setValue] = useState(0);  // sempre em reais (number)

  return (
    <MoneyInput
      value={value}            // number, em reais
      onChange={setValue}      // recebe number em reais
      min={0.01}               // opcional — default 0
      max={9999.99}            // opcional — default Number.MAX_SAFE_INTEGER
      placeholder="R$ 0,00"    // opcional — default "R$ 0,00"
      aria-label="Valor/hora"  // recomendado para a11y
    />
  );
}
```

### Comportamento cents-first (resumo)

| Input | Display | `value` publicado |
|---|---|---|
| `"8"` | `R$ 0,08` | `0.08` |
| `"85"` | `R$ 0,85` | `0.85` |
| `"850"` | `R$ 8,50` | `8.5` |
| `"8500"` | `R$ 85,00` | `85` |
| `"999999"` | `R$ 9.999,99` | `9999.99` |
| `"9999991"` | `R$ 9.999,99` (7º dígito bloqueado) | `9999.99` |
| `Backspace` sobre `R$ 85,00` | `R$ 8,50` | `8.5` |
| Paste `"R$ 1.234,56"` | `R$ 12,34` (apenas dígitos `1234`) | `12.34` |

### Integração com React Hook Form

```typescript
const form = useForm<StudioFormValues>({
  resolver: zodResolver(studioFormSchema),
  defaultValues: { name: "", defaultHourlyRate: 0 },
});

<Controller
  name="defaultHourlyRate"
  control={form.control}
  render={({ field }) => (
    <MoneyInput
      value={field.value}
      onChange={field.onChange}
      min={0.01}
      max={9999.99}
      aria-invalid={!!form.formState.errors.defaultHourlyRate}
    />
  )}
/>
```

---

## 4. Rodando os testes da feature

Durante o desenvolvimento iterativo (Princípio XVI), rode apenas os testes diretamente afetados:

```fish
# Unit (Zod schema, service, API handlers, MoneyInput)
bun run test:unit __tests__/unit/domain/studio-schema.spec.ts
bun run test:unit __tests__/unit/services/studio-service.spec.ts
bun run test:unit __tests__/unit/components/money-input.spec.ts
bun run test:unit __tests__/unit/api/studios-create.spec.ts

# Integration (DrizzleStudioRepository contra Postgres)
bun run test:integration __tests__/integration/repositories/drizzle-studio-repository.spec.ts

# E2E (Playwright contra /studios)
bun run test:e2e __tests__/e2e/studios-create.spec.ts
```

Na **fase final** antes do PR (ver Princípio XVI), rodar tudo:

```fish
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

---

## 5. Debugging comum

### "relation \"studio\" does not exist"

A migração não foi aplicada. Rodar `bun run db:migrate` no banco apontado por `DATABASE_URL`.

### Valor monetário salvo como `"85"` em vez de `"85.00"`

Sinal de que o `.toFixed(2)` na borda do repository não foi aplicado. Conferir `DrizzleStudioRepository.create` / `update` — o insert deve receber **string com exatamente 2 decimais** (ver research §R2).

### `MoneyInput` não aceita Backspace

Conferir se `handleKeyDown` está registrado via `onKeyDown` (não `onKeyPress` — deprecated). A ausência de `event.preventDefault()` causaria o browser a processar o Backspace no valor formatado (que não é o desejado), produzindo estado inconsistente.

### `defaultHourlyRate` chega como `string` no service/domain

A conversão deve acontecer **no repository**, não no service. Se o service está recebendo string, há um bypass (provavelmente em um fake que não faz a conversão). InMemoryStudioRepository deve sempre operar com `number`.

### E2E test falha com "unique constraint" entre runs

O fixture E2E não está preservando o TRUNCATE seletivo de `studio`. Conferir que a fixture `authenticatedPage` executa `TRUNCATE TABLE studio RESTART IDENTITY CASCADE` em `beforeEach`. Studios criados por `createTestStudio` devem ser automaticamente derrubados entre testes.

---

## 6. Próximos passos (fora desta feature)

Quando o CRUD de **Livros** for implementado:
1. Adicionar FK `book.studio_id REFERENCES studio(id)` + índice.
2. Incluir coluna "Livros" na tabela em `/studios` (anotado em `futuras-features.md`).
3. Adicionar constraint no service: não excluir estúdio com livros em status ativo (pendente, em edição, em revisão, edição retake).
4. Reusar `MoneyInput` no formulário de criação de Livros com `value` pré-preenchido a partir de `studio.defaultHourlyRate`.
