# Research — CRUD de Narradores

Consolidação das decisões técnicas necessárias para implementar a feature, com alternativas consideradas e motivação.

---

## 1. TanStack Table via shadcn/ui DataTable

**Decision**: Usar `@tanstack/react-table` como engine de tabela, seguindo o padrão oficial do shadcn/ui (DataTable). Adicionar os componentes `table` (shadcn) + instalar `@tanstack/react-table` como dependência de cliente. Sort client-side via `getSortedRowModel()`.

**Rationale**:
- shadcn/ui não possui componente DataTable pronto — eles publicam um tutorial onde o desenvolvedor constrói a DataTable combinando `@tanstack/react-table` + o primitivo `table`. Este é o caminho canônico recomendado pela própria documentação do shadcn.
- O volume esperado é pequeno (dezenas), então sort client-side é suficiente e elimina round-trips de API.
- TanStack Table é headless, permitindo estilização via tokens do projeto sem conflito.

**Alternatives considered**:
- **React Table rolled-by-hand**: rejeitado — reinventa sort/filter e quebra o princípio "use shadcn/ui" (o tutorial oficial shadcn _é_ TanStack Table).
- **Material React Table / Mantine Table**: rejeitado — introduziria uma segunda design system em conflito com shadcn/ui.
- **Server-side sort via query param**: rejeitado por YAGNI — volume não justifica.

**Install**:
```bash
bun add @tanstack/react-table
bunx --bun shadcn@latest add table scroll-area alert-dialog form dialog
```

---

## 2. Inline Row Editing com React Hook Form

**Decision**: Cada linha editável (edit mode ou new row) possui sua própria instância de `useForm` com `zodResolver`. Estado de edição é local à linha (`isEditing: boolean`), gerenciado por `useState`. Cancel chama `form.reset(originalValues)` restaurando os defaults. Confirm chama `form.handleSubmit` que dispara POST ou PATCH.

**Rationale**:
- React Hook Form mantém cada form isolado — múltiplas linhas editando simultaneamente não conflitam (FR-011 exige operações independentes).
- `form.reset(originalValues)` é a primitiva exata para restaurar valores originais em cancel (FR-008).
- `zodResolver` permite reutilizar os mesmos schemas Zod usados no backend, garantindo validação consistente cliente/servidor.
- Defaults dinâmicos: a row existente inicia com `defaultValues: { name, email }` do narrador; a new row inicia com `{ name: "", email: "" }`.

**Alternatives considered**:
- **Um único `useForm` para toda a tabela (array fields)**: rejeitado — complexidade alta, difícil lidar com validação per-row e é inflexível para a new row.
- **Editar em modal/drawer ao invés de inline**: rejeitado — contraria o requisito explícito da spec (tabela editável inline).
- **State management global (Zustand/Redux)**: rejeitado por YAGNI — state local é suficiente.

**Pattern Reference**:
```tsx
const form = useForm<NarratorFormValues>({
  resolver: zodResolver(narratorFormSchema),
  defaultValues: { name: narrator.name, email: narrator.email },
});
// cancel → form.reset({ name: narrator.name, email: narrator.email })
// confirm → form.handleSubmit(async (values) => await updateNarrator(narrator.id, values))
```

---

## 3. Estratégia de Cor Destrutiva (FR-015/FR-016)

**Decision**: Quando `data-primary-color="red"` estiver aplicado ao `<html>`, sobrescrever o token CSS `--destructive` para um tom mais escuro e saturado tendendo ao bordô/crimson, usando OKLCH. O ícone de exclusão (`lucide:trash-2`) e o botão "Excluir" do `AlertDialog` usam `text-destructive` / `bg-destructive`, herdando automaticamente o override.

**Valores OKLCH escolhidos**:

| Modo | Primary (red) | Destructive default | Destructive (red primary) |
|------|---------------|---------------------|---------------------------|
| Light | `oklch(0.627 0.257 29)` | `oklch(0.577 0.245 27.325)` | `oklch(0.42 0.20 12)` — bordô escuro |
| Dark  | `oklch(0.704 0.191 22)` | `oklch(0.704 0.191 22.216)` | `oklch(0.55 0.22 8)` — crimson |

**Rationale**:
- No sistema atual, quando o usuário escolhe primary red, `--primary` ≈ `oklch(0.627 0.257 29)` e `--destructive` ≈ `oklch(0.577 0.245 27.325)`. Lightness e hue são **quase idênticos** — o ícone de deletar fica visualmente fundido com elementos primários (botão "+ Novo Narrador" usa `--primary`).
- Shiftar a matiz para ~10° (true red tendendo ao crimson) e reduzir lightness gera contraste claro: usuário distingue imediatamente "ação perigosa" vs "ação primária".
- A mudança fica isolada em `globals.css` atrás do seletor `html[data-primary-color="red"]` — zero impacto nas outras 4 variantes (blue, orange, green, amber), que já têm contraste natural com o destructive default (hue 27°).
- Testar contraste: distância OKLCH entre primary red e destructive ajustado ≥ 0.2 em lightness, suficiente para percepção distinta.

**CSS snippet** (a adicionar em `globals.css`):
```css
html[data-primary-color="red"] {
  --destructive: oklch(0.42 0.20 12);
}

html[data-primary-color="red"].dark,
html[data-primary-color="red"] .dark {
  --destructive: oklch(0.55 0.22 8);
}
```

**Alternatives considered**:
- **Manter destructive default em todos os casos**: rejeitado — falha FR-016 e SC-005.
- **Usar amarelo/laranja para destructive quando primary é red**: rejeitado — quebra convenção de "vermelho = perigo" e pode ser confundido com warning.
- **Trocar para outline destructive button quando primary é red**: rejeitado — adiciona condicional em cada uso; override de token é mais limpo.

---

## 4. AlertDialog para Confirmação de Exclusão

**Decision**: Usar `AlertDialog` do shadcn/ui (baseado em `@base-ui/react` ou Radix). Estrutura: `AlertDialogTrigger` com ícone `trash-2` na coluna Ações → `AlertDialogContent` com título, descrição mencionando o nome do narrador, `AlertDialogCancel` e `AlertDialogAction` estilizado com `variant="destructive"`.

**Rationale**:
- Alert dialog é o padrão para ações destrutivas irreversíveis (confirma antes de executar) — exatamente FR-009.
- shadcn `AlertDialog` gerencia acessibilidade (focus trap, ESC, aria-describedby) automaticamente.
- Permite passar o nome do narrador via prop para texto contextual ("Tem certeza que deseja excluir o narrador João Silva?").

**Alternatives considered**:
- **Dialog (não-alert)**: rejeitado — alert dialogs bloqueiam interação e sinalizam ação destrutiva; dialogs comuns são para conteúdo não-crítico.
- **Toast com botão "desfazer"**: rejeitado — requisito explícito é confirmação prévia (prevenção), não remediação pós-fato.
- **`window.confirm()`**: rejeitado — não respeita design tokens nem dark mode.

---

## 5. Design da API REST

**Decision**: Quatro rotas seguindo padrões REST do Princípio X.

| Método | URL | Status sucesso | Payload |
|--------|-----|----------------|---------|
| GET | `/api/v1/narrators` | 200 | `{ data: Narrator[] }` |
| POST | `/api/v1/narrators` | 201 + `Location` | `{ data: Narrator }` |
| PATCH | `/api/v1/narrators/:id` | 200 | `{ data: Narrator }` |
| DELETE | `/api/v1/narrators/:id` | 204 | (sem body) |

**Status de erro**:
- `401` Unauthorized — sem sessão
- `422` Unprocessable Entity — validação Zod falhou
- `404` Not Found — id inexistente
- `409` Conflict — e-mail duplicado (`{ error: { code: "EMAIL_ALREADY_IN_USE", ... } }`) ou narrador vinculado a capítulos em andamento (`code: "NARRATOR_HAS_ACTIVE_CHAPTERS"`, **implementação diferida**)

**Rationale**:
- Lista sem paginação consistente com Princípio IV (YAGNI) e SC-006 (volume pequeno).
- PATCH ao invés de PUT — update parcial permite alterar apenas name ou apenas email.
- Códigos de erro em `UPPER_SNAKE_CASE` seguindo convenção do `responses.ts` existente.

**Alternatives considered**:
- **GET com cursor/offset pagination**: rejeitado — YAGNI.
- **PUT para update**: rejeitado — semanticamente exige replacement completo; PATCH reflete a realidade (campos opcionais).

---

## 6. Validação e Schemas Zod

**Decision**: Três schemas em `lib/domain/narrator.ts`:

```typescript
export const narratorFormSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
});

export const createNarratorSchema = narratorFormSchema; // POST body
export const updateNarratorSchema = narratorFormSchema.partial(); // PATCH body (ambos opcionais)
```

**Rationale**:
- Reutilização: o mesmo `narratorFormSchema` valida na UI (via `zodResolver`) e no POST server-side. `updateNarratorSchema` permite PATCH parcial.
- `.trim()` remove espaços em branco acidentais; `.toLowerCase()` normaliza e-mails (evita duplicatas por case).
- Mensagens em português para feedback visual direto no form.

**Alternatives considered**:
- **Schemas separados (createSchema + updateSchema)** sem derivação: rejeitado — duplicação e drift.
- **Validação apenas no backend**: rejeitado — viola UX (usuário só recebe feedback depois de submeter).

---

## 7. Tratamento do Erro de E-mail Duplicado

**Decision**: Repository Drizzle captura `unique_violation` (PostgreSQL error code `23505`) e lança `NarratorEmailAlreadyInUseError` (erro de domínio). Service propaga. Route handler converte em HTTP 409 com `{ error: { code: "EMAIL_ALREADY_IN_USE", message } }` via `lib/api/responses.ts`.

**Rationale**:
- Verificar unicidade via `SELECT` antes de `INSERT` sofre race conditions. Confiar no constraint do banco é atômico e correto.
- Erro de domínio nomeado permite testar service isoladamente sem mock do driver de DB.
- Type narrowing no route handler via `instanceof` mantém tipagem estrita (sem `any`).

**Alternatives considered**:
- **Check-and-insert não-transacional**: rejeitado — race condition real entre dois POSTs simultâneos.
- **String matching do erro Postgres**: rejeitado — frágil; usar o code do driver (`pg`) é estável.

---

## 8. Estratégia de Testes

**Decision**:

| Camada | Local | O que testa | Dependências |
|--------|-------|-------------|--------------|
| **Unit — schemas** | `__tests__/unit/domain/narrator-schema.test.ts` | `narratorFormSchema` (happy path + mensagens de erro) | Zod puro |
| **Unit — service** | `__tests__/unit/services/narrator-service.test.ts` | `NarratorService` (create/update/delete/findAll) com `InMemoryNarratorRepository` | Fake repo (classe) |
| **Unit — API** | `__tests__/unit/api/narrators.test.ts` | Route handlers (401, 422, 409, happy path) com deps injetadas | `vi.fn()` para session e service |
| **Integration** | `__tests__/integration/repositories/drizzle-narrator-repository.test.ts` | `DrizzleNarratorRepository` (CRUD real, unique violation) | DB real via transaction rollback |
| **E2E** | `__tests__/e2e/narrators.spec.ts` | Listar, criar, editar inline, excluir com modal, sorting | App rodando, DB real, auth helper |

**Rationale**:
- Alinhado com constituição (Princípio V) e CLAUDE.md: `vi.mock()` apenas para módulos na allowlist; tudo interno usa fakes via DI.
- `InMemoryNarratorRepository` reutilizável entre suites (padrão já existe em `__tests__/repositories/in-memory-user-preference-repository.ts`).
- E2E usa `loginAsTestUser` helper criado na feature 014 (sessão anterior).

**Alternatives considered**:
- **Somente E2E**: rejeitado — cobertura fica com feedback lento; unit valida lógica de domínio em ms.
- **`vi.mock("@/lib/services/narrator-service")` no route handler test**: rejeitado — viola a convenção de test doubles do projeto.

---

## 9. Integração com Auth Existente

**Decision**: Reutilizar `auth.api.getSession({ headers: await headers() })` no padrão `user-preferences/route.ts`. Todas as 4 rotas retornam `401` via `unauthorizedResponse()` quando não há sessão. Middleware existente já protege a rota `/narrators` no grupo `(authenticated)`.

**Rationale**: Padrão estabelecido; não há requisito de permissão granular (qualquer usuário autenticado pode gerenciar narradores).

---

## 10. Estratégia de Cache e Revalidação

**Decision**: Server Component da página `/narrators` faz fetch direto via service (não via `fetch()` HTTP) — SSR executa o service inline. Após operações mutation (POST/PATCH/DELETE), o Client Component atualiza o state local e chama `router.refresh()` (Next.js) para resync com servidor. Não usar `revalidatePath` no server action (não temos server actions nesta feature; usamos route handlers).

**Rationale**:
- Chamar service direto no Server Component é mais rápido que fetch HTTP interno (evita round-trip).
- `router.refresh()` após mutation garante que o próximo SSR traga os dados atualizados sem precisar de cache tag.
- Como não há múltiplos consumidores fora da página `/narrators`, não justifica infra de cache (Princípio IV).

**Alternatives considered**:
- **React Query / SWR**: rejeitado — state local é suficiente; adicionar dependência client-side viola Princípio VIII.
- **Server Actions**: rejeitado — arquitetura do projeto usa route handlers consistentemente; manter consistência.

---

## 11. Acessibilidade

**Decision**: Reutilizar acessibilidade nativa do shadcn/ui (focus trap no AlertDialog, ARIA labels, keyboard nav no Table). Cabeçalhos sortable com `role="columnheader" aria-sort`. Ícones de ação (`Edit`, `Trash`) com `sr-only` label descritivo. Teste de acessibilidade via `@axe-core/playwright` no E2E.

**Rationale**: shadcn/ui já atende WCAG 2.1 AA por padrão. Adicionar apenas o que falta (aria-sort nos headers, sr-only nos icon buttons).

---

## Resumo das Dependências Novas

| Pacote | Versão | Categoria | Motivação |
|--------|--------|-----------|-----------|
| `@tanstack/react-table` | ^8.x | Client dependency | Engine da tabela (canônico shadcn/ui) |
| shadcn `table` | (copy) | UI primitive | Table shadcn/ui |
| shadcn `scroll-area` | (copy) | UI primitive | Wrapper de scroll (FR-012) |
| shadcn `alert-dialog` | (copy) | UI primitive | Modal de confirmação (FR-009) |
| shadcn `form` | (copy) | UI primitive | Integração RHF + label/error rendering |
| shadcn `dialog` | (copy) | UI primitive | (dependência transitiva do alert-dialog) |

Nenhuma outra dependência runtime é necessária.
