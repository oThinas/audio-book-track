# Research: CRUD de Estúdios

**Feature**: 019-studios-crud
**Date**: 2026-04-21
**Status**: Complete — 7 decisões consolidadas, zero `NEEDS CLARIFICATION` pendente.

---

## R1 — UX cents-first para `MoneyInput`

### Decision

Implementar `MoneyInput` como componente controlado com **state interno em centavos (integer)**, exibição via `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`, e publicação de `onChange` com valor em reais (`number`, ex: `85`, `85.5`). Interceptar input através de:

- `onBeforeInput` para bloquear caracteres não-numéricos (teclado físico + IME).
- `onKeyDown` para capturar `Backspace` removendo o último dígito acumulado.
- `onPaste` para aceitar apenas os dígitos do conteúdo colado.
- `value` prop em reais (number). Internamente: `cents = Math.round(value * 100)`.

Usar `<input type="text" inputMode="numeric">` (não `type="number"` — que permitiria `-`, `e`, `.`, setas incrementais).

### Rationale

- **State em centavos (integer)** evita completamente floating-point quando acumulando dígitos: `cents * 10 + newDigit` é sempre exato.
- **`Intl.NumberFormat` pt-BR** já é suporte nativo do browser; zero dependência adicional.
- **`inputMode="numeric"`** ativa teclado numérico em mobile sem restringir a `type="number"` (que tem side-effects como ignorar leading zeros e auto-arredondamento).
- **`onBeforeInput` + `onKeyDown` + `onPaste`** cobrem os 3 vetores de entrada; evita divergência entre display e state que aconteceria se usássemos apenas `onChange`.
- **Valor publicado em reais (number)** é a API natural para RHF/Zod — consumidores nunca lidam com centavos.

### Alternatives considered

- **`contentEditable`**: mais flexível mas exige sincronizar cursor manualmente, não funciona bem com RHF e quebra acessibilidade. **Rejeitado**.
- **`react-imask` / `react-number-format`**: dependência externa para UX que pode ser implementada em ~100 linhas. YAGNI + Princípio VIII (bundle). **Rejeitado**.
- **State em `number` de reais** em vez de centavos: introduziria `0.1 + 0.01 = 0.11000000000000001`. **Rejeitado**.
- **`type="number"`**: permite caracteres como `e`, `-`, `.`, setas que quebrariam o cents-first. **Rejeitado**.

### Public API do componente

```typescript
interface MoneyInputProps {
  value: number;                    // em reais (ex: 85, 85.5)
  onChange: (value: number) => void;
  min?: number;                     // default 0
  max?: number;                     // default Number.MAX_SAFE_INTEGER (Studios usa 9999.99)
  name?: string;
  id?: string;
  placeholder?: string;             // default "R$ 0,00"
  disabled?: boolean;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  className?: string;
}
```

### Implementation sketch

```typescript
"use client";
import { type KeyboardEvent, type FormEvent, useMemo } from "react";

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function MoneyInput({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, ...rest }: MoneyInputProps) {
  const cents = Math.round(value * 100);
  const maxCents = Math.round(max * 100);
  const displayValue = useMemo(() => BRL_FORMATTER.format(cents / 100), [cents]);

  function setCents(nextCents: number) {
    const clamped = Math.min(nextCents, maxCents);
    onChange(clamped / 100);
  }

  function handleBeforeInput(event: FormEvent<HTMLInputElement>) {
    const data = (event.nativeEvent as InputEvent).data;
    if (data === null || data === "") return;
    if (!/^\d$/.test(data)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setCents(cents * 10 + Number(data));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      event.preventDefault();
      setCents(Math.floor(cents / 10));
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (digits.length === 0) return;
    let next = cents;
    for (const d of digits) {
      next = next * 10 + Number(d);
      if (next > maxCents) { next = maxCents; break; }
    }
    setCents(next);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={displayValue}
      onBeforeInput={handleBeforeInput}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onChange={() => { /* noop — handled by onBeforeInput */ }}
      {...rest}
    />
  );
}
```

**Nota**: `onChange` noop é necessário para evitar warning do React em controlled input; toda mutação passa por `onBeforeInput`/`onKeyDown`/`onPaste`.

---

## R2 — Drizzle `numeric(10,2)` ↔ JS `number`

### Decision

O driver Drizzle retorna `numeric` como **`string`** por padrão (preservando precisão). No `DrizzleStudioRepository`:

- **Leitura**: mapear `row.default_hourly_rate` (string) → `Number(row.default_hourly_rate)` (number) na borda de saída de `findAll/findById/findByName`. Construtor do `Studio` recebe o number já convertido.
- **Escrita**: receber `number` de `CreateStudioInput`/`UpdateStudioInput`, converter para `string` via `toFixed(2)` antes do `db.insert(...).values({ defaultHourlyRate: "85.00" })`.

Conversão encapsulada em helpers privados `toDomainRow()` / `toDrizzleInsert()` dentro do próprio repository — **não** usar `.$type<number>()` do Drizzle (veja alternatives).

### Rationale

- **Faixa R$ 0,01 – R$ 9.999,99** está dentro do intervalo seguro de `Number` (≤ 2^53). Conversão `string ↔ number` é lossless.
- **Encapsulamento na borda** isola a "poluição" de strings numéricas ao repository; service e domain operam sempre em `number`, alinhado ao Princípio VI (Clean Architecture).
- **`toFixed(2)`** garante exatamente 2 casas decimais no insert, blindando contra `85` virar `"85"` (sem decimal), o que falharia sutilmente em comparações downstream.

### Alternatives considered

- **`numeric({ precision: 10, scale: 2, mode: "number" })`**: confirmado via Context7 (2026-04-21) que Drizzle 0.45+ suporta esse modo — controla **apenas o read** (retorna `number` em vez de `string`). O **write ainda exige `string`** (a própria doc avisa: "unitPrice must be a string type in Drizzle ORM (not number) to support precision"). Ou seja, `mode: "number"` eliminaria apenas a conversão `Number(row.default_hourly_rate)` na leitura; a conversão `.toFixed(2)` na escrita permaneceria. Ganho marginal. **Manter a decisão atual** de conversão explícita na borda do repository — prós: (a) comportamento 100% simétrico entre leitura e escrita, (b) não depende de um modo de API; (c) integration test cobre o round-trip de forma independente da configuração. **Rejeitado** como troca, mas **permitido** reavaliar se surgir outro consumidor `numeric` no projeto.
- **Manter `string` no domain**: forçaria RHF e UI a tratarem strings, o que quebra a API do `MoneyInput` que publica `number`. **Rejeitado**.
- **Usar `bigint` cents no banco**: requisitos de relatório financeiro (Princípio XIII) esperam `numeric`. Mudança estrutural sem benefício nesta faixa. **Rejeitado**.

### Implementation sketch

```typescript
// drizzle-studio-repository.ts

function toDomain(row: typeof STUDIO_COLUMNS[keyof typeof STUDIO_COLUMNS] /* row */): Studio {
  return {
    id: row.id,
    name: row.name,
    defaultHourlyRate: Number(row.defaultHourlyRate),  // string → number
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDrizzleValues(input: { name: string; defaultHourlyRate: number }) {
  return {
    name: input.name,
    defaultHourlyRate: input.defaultHourlyRate.toFixed(2),  // number → "85.00"
  };
}
```

### Validation

Integration test cobre round-trip explícito: insert `85.00`, read back, assert `=== 85` (number, não string).

---

## R3 — Mapeamento de unique-violation: duplicar ou extrair helper?

### Decision

**Duplicar** o helper `getUniqueConstraintName` / `extractConstraint` de `DrizzleEditorRepository` para `DrizzleStudioRepository`. **Não** extrair para `lib/db/postgres-errors.ts` ainda.

### Rationale

- YAGNI (Princípio IV): duplicação de ~20 linhas em dois repositórios ≠ problema imediato; três consumidores seria o threshold razoável para extração.
- O editor-plan.md já documenta essa decisão (§Post-Design Re-Check de 018). Mantemos consistência — extrair quando houver o terceiro consumidor (provavelmente `DrizzleBookRepository`).
- A duplicação é trivial e o refactor futuro é de baixo custo (renomes + mover 2 funções).

### Alternatives considered

- **Extrair agora** para `lib/db/postgres-errors.ts`: seria um refactor que **não** foi pedido pela feature; viola "complexidade justificada por requisito concreto existente" (Princípio IV). **Rejeitado**.
- **Importar de `drizzle-editor-repository`**: cria acoplamento reverso (estúdio dependendo de editor). **Rejeitado**.

### Implementation note

No PR desta feature, adicionar comentário de ≤1 linha em ambos repositórios sinalizando que, ao criar o terceiro consumidor (book), extrair o helper — **não** criar documentação paralela.

---

## R4 — Zod schema para `defaultHourlyRate`

### Decision

```typescript
defaultHourlyRate: z
  .number({ error: "Valor/hora é obrigatório" })
  .min(0.01, "Valor/hora mínimo é R$ 0,01")
  .max(9999.99, "Valor/hora máximo é R$ 9.999,99")
  .refine(
    (v) => Number.isInteger(Math.round(v * 100)) && Math.abs(v * 100 - Math.round(v * 100)) < 1e-9,
    "Valor/hora deve ter no máximo 2 casas decimais",
  );
```

**Não** usar `.multipleOf(0.01)` por causa de floating-point (e.g., `0.1 + 0.2 !== 0.3`). O `.refine` com tolerância `1e-9` é robusto para valores `≤ R$ 9.999,99`.

### Rationale

- `.multipleOf(0.01)` falha com `0.07 * 3 = 0.21000000000000002`, rejeitando valores válidos.
- Arredondar para `Math.round(v * 100)` e verificar se a diferença absoluta é < `1e-9` funciona dentro da faixa segura de `Number`.
- Ordem das validações (`min` → `max` → `refine`) garante que o usuário vê a mensagem mais específica primeiro.

### Alternatives considered

- **`.multipleOf(0.01)`**: falha com floating-point. **Rejeitado**.
- **Aceitar `string` no schema e parsear internamente**: complica o contrato API (multipart vs. pure JSON) e desalinha com `MoneyInput` que publica `number`. **Rejeitado**.
- **Aceitar cents como integer no schema**: muda contrato API; exigiria tradução cliente. **Rejeitado** — mantemos reais na API, centavos apenas dentro do `MoneyInput`.

### Test coverage

Unit tests devem cobrir:
- `0.01` ✅ (limite inferior inclusivo)
- `0.009` ❌ (abaixo do limite)
- `0` ❌
- `-1` ❌
- `9999.99` ✅ (limite superior inclusivo)
- `10000` ❌
- `85` ✅ (sem decimal — `.toFixed(2)` gera "85.00")
- `85.5` ✅ (1 decimal — aceito)
- `85.55` ✅ (2 decimais)
- `85.555` ❌ (3 decimais — refinement)
- `0.07 * 3` → arredondado para `0.21` ✅ (robustez floating-point)

---

## R5 — Ordenação default: asc no repo + desc no client

### Decision

Manter exatamente o padrão já consolidado em `editors-client.tsx` / `narrators-client.tsx`:

- **Repository** (`drizzle-studio-repository.ts`): `orderBy(asc(studio.createdAt))`.
- **Client** (`studios-client.tsx`): `useMemo(() => [...studios].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [studios])`.

Expor a lista ordenada DESC ao `StudiosTable` para renderização.

### Rationale

- Espelha o padrão existente → zero divergência arquitetural, testes E2E podem ser clonados sem adaptação de ordenação.
- A motivação original (corrigida em editors/narrators): durante a criação inline, a linha "novo registro" fica no topo via `topRow` — se o servidor retornasse DESC, a linha recém-criada mudaria de posição após o `revalidate`. Mantendo a inversão no client, a estabilidade visual é preservada.
- Separação de responsabilidade: o repositório retorna "cronológico natural" (asc = ordem de inserção); o consumidor decide a apresentação.

### Alternatives considered

- **DESC no repository**: quebra o padrão existente. Requer migração posterior se Livros quiserem reusar a mesma convenção. **Rejeitado**.
- **DESC no repository + ASC no cliente**: contraintuitivo; repositório deixa de representar ordem cronológica natural. **Rejeitado**.
- **Sem ordenação no repository (id ASC natural)**: insere dependência implícita em ordem de geração de UUID v4 (aleatória). **Rejeitado**.

---

## R6 — Factory em vez de seed: impacto em quickstart e E2E

### Decision

Seguir rigorosamente o Princípio V: **zero seed** de estúdios. Consequências:

1. **`quickstart.md`** informa que o produtor deve criar manualmente o primeiro estúdio ao acessar `/studios` pela primeira vez em dev.
2. **Testes integration** (`drizzle-studio-repository.spec.ts`) usam `createTestStudio(db, overrides)` em `beforeEach` ou dentro do próprio teste. O BEGIN/ROLLBACK descarta ao fim de cada teste.
3. **Testes E2E** (`studios-*.spec.ts`) criam os estúdios via factory **dentro do fixture autenticado** antes de navegar para `/studios`. O `TRUNCATE seletivo` entre testes preserva apenas `user`/`account`/`session`/`__drizzle_migrations`, derrubando a tabela `studio` a cada teste.
4. **`seed.ts`** e **`seed-test.ts`** permanecem **intocados**.

### Rationale

- Constituição §"Factory, não seed, para novas entidades" é mandatória.
- Mantém `seed-test.ts` estável (1 linha — admin), que é a única dependência compartilhada entre todos os testes E2E.
- E2E tests documentam explicitamente o pré-estado que precisam (via `createTestStudio`) em vez de depender de "existe um seed lá atrás que inclui Sonora Studio" — aumenta legibilidade e resiliência a mudanças.

### Alternatives considered

- **Seed de 3 estúdios em `seed.ts` apenas (dev)**: decisão rejeitada explicitamente pelo usuário na Q4 da sessão de clarificação. **Rejeitado**.
- **Seed condicional via `NODE_ENV`**: aumenta complexidade; viola Princípio IV. **Rejeitado**.

### createTestStudio signature

```typescript
interface CreateTestStudioOptions {
  readonly name?: string;
  readonly defaultHourlyRate?: number;
}

interface CreateTestStudioResult {
  readonly studio: typeof studio.$inferSelect & { defaultHourlyRate: number };
}

export async function createTestStudio(
  db: TestDb,
  overrides: CreateTestStudioOptions = {},
): Promise<CreateTestStudioResult> {
  const suffix = randomUUID().slice(0, 8);
  const [row] = await db
    .insert(studio)
    .values({
      name: overrides.name ?? `Studio ${suffix}`,
      defaultHourlyRate: (overrides.defaultHourlyRate ?? 85).toFixed(2),
    })
    .returning();
  return { studio: { ...row, defaultHourlyRate: Number(row.defaultHourlyRate) } };
}
```

---

## R7 — Localização de `MoneyInput`

### Decision

`src/components/ui/money-input.tsx`.

### Rationale

- Atômico, sem lógica de domínio, sem fetch, sem dependência de outros componentes do projeto além de tokens Tailwind — é a definição exata de primitivo de UI.
- Convenção do projeto: shadcn/ui primitivos vivem em `components/ui/` (ver `button.tsx`, `input.tsx`, `dialog.tsx`). O `MoneyInput` se encaixa 1:1.
- Futuro CRUD de Livros já depende desse path explicitamente (FR-025a) — posicionar em `components/shared/` ou outro lugar exigiria renomear depois.

### Alternatives considered

- **`src/components/shared/money-input.tsx`**: convenção inexistente no projeto. **Rejeitado**.
- **`src/components/features/studios/money-input.tsx`**: violaria a garantia de reuso em Livros (componente ficaria "colocado" em uma feature). **Rejeitado**.
- **`src/lib/ui/money-input.tsx`**: mistura `lib/` (dominantly non-React) com React. **Rejeitado**.

---

## Summary

| Ref | Tópico | Decisão |
|---|---|---|
| R1 | UX cents-first | State em centavos (integer) + `Intl.NumberFormat` + `onBeforeInput`/`onKeyDown`/`onPaste` |
| R2 | Drizzle `numeric` ↔ `number` | Conversão na borda do repository (`Number()` leitura, `.toFixed(2)` escrita) |
| R3 | Unique-violation helper | Duplicar de `DrizzleEditorRepository`; extrair apenas quando houver 3º consumidor |
| R4 | Zod schema faixa | `min(0.01).max(9999.99).refine(…)` — evitar `multipleOf(0.01)` por floating-point |
| R5 | Ordenação | `asc(createdAt)` no repo + DESC via `useMemo` no client |
| R6 | Sem seed | `createTestStudio(db, overrides)` em factories; `seed.ts` e `seed-test.ts` intocados |
| R7 | Localização `MoneyInput` | `src/components/ui/money-input.tsx` |

Todas as decisões pré-Phase 1 estão consolidadas. Nenhum `NEEDS CLARIFICATION` pendente.
