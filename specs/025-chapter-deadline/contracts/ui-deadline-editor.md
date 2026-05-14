# UI Contract: Date Picker do prazo no modo edição da linha

**Feature**: 025-chapter-deadline
**Component**: `src/components/features/chapters/chapter-deadline-picker.tsx` (NOVO)
**Consumer**: `chapter-row-edit-mode.tsx` (estende form da linha)

---

## Props

```ts
interface ChapterDeadlinePickerProps {
  readonly value: string | null;            // "YYYY-MM-DD" ou null
  readonly onChange: (next: string | null) => void;
  readonly disabled?: boolean;              // true quando chapter.status === "paid"
  readonly id?: string;                     // para <label htmlFor>
}
```

Integração com React Hook Form via `Controller`:

```tsx
<Controller
  control={form.control}
  name="deadline"
  render={({ field }) => (
    <ChapterDeadlinePicker
      value={field.value}
      onChange={field.onChange}
      disabled={chapter.status === "paid"}
    />
  )}
/>
```

---

## Composição (shadcn)

```tsx
<Popover>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      disabled={disabled}
      className={cn("w-[180px] justify-start text-left font-normal",
                    !value && "text-muted-foreground")}
    >
      <CalendarIcon className="mr-2 h-4 w-4" aria-hidden />
      {value ? formatDeadline(value) : "Definir prazo"}
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-auto p-0">
    <Calendar
      mode="single"
      selected={value ? parseISO(value) : undefined}
      onSelect={(date) => onChange(date ? formatISODate(date) : null)}
      locale={ptBR}
      weekStartsOn={1}
      fromYear={currentYearInAppTz - 10}
      toYear={currentYearInAppTz + 10}
    />
    <div className="flex items-center justify-between border-t p-2">
      <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
        Limpar
      </Button>
      <PopoverClose asChild>
        <Button variant="default" size="sm">OK</Button>
      </PopoverClose>
    </div>
  </PopoverContent>
</Popover>
```

`formatISODate(date)` constrói `YYYY-MM-DD` a partir das **partes locais** da `Date` (não usar `toISOString()` para evitar conversão de fuso).

---

## Estado e validação

- Componente é controlado — não gerencia estado interno do valor. Só do popover aberto/fechado (estado puramente visual, OK no client).
- Validação não ocorre aqui — fica em Zod (`updateChapterSchema`) no submit do form pai.
- Mensagem de erro do form (ex: "Data limite não pode ser superior a 10 anos no futuro.") é exibida pelo wrapper (`<FormItem><FormMessage/>`).

---

## Acessibilidade

- Botão trigger tem label visível ("Definir prazo" ou data). Quando ícone está sozinho, mesmo princípio de `aria-hidden` + label visível por texto.
- Popover é `role="dialog"`, focus-trap pelo Radix.
- Calendar navega via teclado (setas, Page Up/Down para mês, Home/End para semana). Suporte vem do `react-day-picker`.
- "Limpar" e "OK" são `<Button>` shadcn (foco visível, atalho `Enter`).
- Quando `disabled`, o trigger não recebe foco e o popover não abre.

---

## Locale

```ts
import { ptBR } from "date-fns/locale";
// passar a `Calendar` via prop `locale={ptBR}` — exibe meses/dias em português.
```

---

## Comportamento quando `paid`

- Trigger renderiza com `disabled`. O texto do valor permanece visível (não escondido) para o gestor ver o valor que está congelado.
- Aria: `aria-disabled="true"`. Sem tooltip de "porque está bloqueado" (consistência com os demais campos paid-locked já desabilitados no row edit mode).

---

## Test plan

### Component

- `value = null`, `disabled = false` → texto "Definir prazo", popover abre ao clicar.
- `value = "2026-06-15"` → texto "15/06/2026", popover abre.
- Clicar dia no `Calendar` → `onChange` recebe ISO da data clicada (sem off-by-one por fuso).
- Clicar "Limpar" → `onChange(null)` disparado, popover continua aberto.
- Clicar "OK" → popover fecha; `onChange` **não** dispara (apenas confirma escolha já feita).
- `disabled = true` → clicar no trigger não abre popover; texto continua visível.
- `weekStartsOn = 1` é refletido visualmente (header começa em "seg").
- Locale: header dos dias é "seg, ter, qua, qui, sex, sáb, dom" e nomes dos meses em português.

### E2E (smoke)

- No modo edição da linha, abrir o picker, selecionar uma data, salvar a linha, e verificar que a célula "Prazo" passa a exibir a data.
- Reabrir o modo edição, clicar em "Limpar", salvar, e verificar que a célula volta a `—`.
