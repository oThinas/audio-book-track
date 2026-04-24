# Research: CRUD de Livros e Capítulos

**Feature**: 020-books-chapters-crud
**Date**: 2026-04-23
**Stage**: Phase 0 — decisões técnicas consolidadas pré-design

Este documento agrupa decisões técnicas para os pontos que saíram da spec (11 clarificações + 3 desvios de constituição) e resolve cada um com **Decision / Rationale / Alternatives considered**.

---

## 1. Status agregado do livro (`book.status`) como cache materializado

**Decision**: Persistir uma coluna enum `book.status` com os mesmos valores de `chapter.status`. Recomputar via helper puro `computeBookStatus(chapters)` chamado pelo service `recomputeBookStatus(bookId, tx)` dentro da mesma transação de qualquer mutação que afete capítulos do livro.

**Rationale**:
- Leitura em `/books` escala linearmente no número de livros (uma coluna) em vez de agregação condicional sobre todos os capítulos — importante mesmo no MVP (SC-005 com 500 livros × até 999 capítulos = até ~500k linhas escaneadas sem o cache).
- Cache materializado é tecnicamente redundante mas mitigado por: (i) nunca editável por API/UI — derivação é exclusiva; (ii) um único ponto de recomputação no service layer (fácil de auditar); (iii) teste de integração valida `book.status === computeBookStatus(chapters)` após cada mutação.
- Evita triggers de banco (mais difíceis de testar e versionar) em favor da camada de service (alinhado ao Princípio VI — lógica fora do SQL).

**Alternatives considered**:
- **Computar on-read via SQL (CASE/aggregate)**: rejeitado por custo de leitura e complexidade da query em listagens.
- **Campo manual editável pelo produtor**: rejeitado por quebrar Princípio I.
- **Trigger PostgreSQL**: rejeitado por (i) dificuldade de teste unitário; (ii) ser "mágica invisível" à camada de service; (iii) migrations para criar/atualizar triggers são mais frágeis.

---

## 2. Soft-delete unificado para estúdio, narrador e editor

**Decision**: Adicionar coluna `deleted_at timestamptz NULL` às três tabelas (`studio`, `narrator`, `editor`). Todas as listagens e seletores filtram `WHERE deleted_at IS NULL`. FKs (`book.studio_id`, `chapter.narrator_id`, `chapter.editor_id`) permanecem `ON DELETE RESTRICT` — na prática nunca disparam porque o UI nunca hard-deleta.

**Rationale**:
- Preserva histórico financeiro e de auditoria (Princípio II): capítulos `paid` continuam referenciando o nome original do estúdio/narrador/editor mesmo após soft-delete.
- Comportamento unificado evita dissonância cognitiva: o produtor aprende uma única regra ("excluir = soft-delete + precondição de não-atividade").
- Permite desarquive automático (ver ponto 3) sem complexidade extra.
- Índice parcial `WHERE deleted_at IS NULL` (conforme Princípio XI) acelera as listagens sem penalizar a escrita.

**Alternatives considered**:
- **Hard-delete com `ON DELETE SET NULL`**: rejeitado (Q11 da clarificação) — perde histórico de quem narrou/editou cada capítulo.
- **Hard-delete bloqueado com qualquer FK**: rejeitado por tornar exclusão impossível após qualquer uso histórico.
- **Apenas em estúdio, deixando narrador/editor com comportamento diferente**: rejeitado pela expectativa explícita do produtor na Q11 de ter comportamento simétrico.

---

## 3. Desarquive automático por colisão de nome

**Decision**: Criar um estúdio/narrador/editor com nome que colide com um registro soft-deleted reativa o registro existente (`UPDATE ... SET deleted_at = NULL`) na mesma transação. HTTP `200 OK` com `{ data, reactivated: true }`. Comparação segue o constraint único da tabela (case-insensitive após `trim`, ou byte-exato conforme a entidade). Toast em UI informa a reativação.

**Rationale**:
- Single path para o produtor: "criar pelo nome" é a interface natural e já existente — não precisa ensinar um conceito novo de "desarquivar".
- Preserva identidade (`id`) do registro original, mantendo trilha de auditoria coerente sem nova entidade.
- Simetria com as três entidades reduz superfície mental.
- Exceção controlada: quando o desarquive ocorre via criação inline no modal de livro (US3), o `default_hourly_rate` é sobrescrito para `R$ 0,01` e segue a propagação FR-012a (idêntico ao fluxo de estúdio novo). Esse caso é raro e documentado via toast adicional, evitando surpresa.

**Alternatives considered**:
- **Toggle "Mostrar arquivados"**: rejeitado (Q9 da clarificação) — adiciona estado de UI persistente em três telas, ícones de "Desarquivar" por linha, e lógica adicional.
- **Página `/studios/archived`**: rejeitado por criar 3 rotas novas e fragmentar a experiência.
- **Fora do MVP (desarquive apenas via banco)**: rejeitado porque colisões de nome são esperadas em uso real, e erro 409 sem recurso natural frustra o produtor.

---

## 4. Cache materializado de `book.status` — regra de precedência

**Decision**: Algoritmo `computeBookStatus(chapters: Chapter[]): BookStatus` com precedência de cima para baixo:

```ts
if (chapters.every(c => c.status === "paid")) return "paid";
if (chapters.every(c => c.status === "completed" || c.status === "paid")
    && chapters.some(c => c.status === "completed")) return "completed";
if (chapters.some(c => c.status === "reviewing" || c.status === "retake")) return "reviewing";
if (chapters.some(c => c.status === "editing")) return "editing";
return "pending";
```

**Rationale**:
- Reflete exatamente os dois cenários que o produtor codificou (US5.13 e US5.14):
  - 2 capítulos (1 `paid` + 1 `pending`) → excluir `pending` → sobra `paid` apenas → `book.status = paid` ✓
  - 1 `paid` → adicionar 1 `pending` → não-todos-paid, sem `reviewing`/`editing`, mas `pending` existe → `pending` ✓
- A função é **pura**, livre de IO, testável por unit test com table-driven cases. 100% de cobertura exigida por SC-010.

**Alternatives considered**:
- **Lógica baseada em "menor status da lista"** (ex: ordenar e pegar o primeiro): rejeitado porque não diferencia os casos de aprovação parcial vs. revisão pending.
- **Fórmula SQL no repository**: rejeitado pelo ponto 1 (separação de lógica da infra).

---

## 5. Propagação transacional de `price_per_hour` para estúdio criado inline

**Decision**: O payload de `POST /api/v1/books` aceita um campo opcional `inlineStudioId` (UUID). Quando presente, o service:
1. Verifica que `inlineStudioId` existe, pertence ao usuário autenticado (ownership via auth já aplicada em `PATCH /studios`) e está atualmente com `default_hourly_rate = 0.01`. A combinação rate-placeholder + ownership é o guard anti-abuso — não há janela temporal.
2. Na mesma transação que cria o livro + N capítulos, faz `UPDATE studio SET default_hourly_rate = :price_per_hour WHERE id = :inlineStudioId`.

**Rationale**:
- Satisfaz FR-012a: apenas estúdios criados inline na sessão atual recebem propagação. Estúdios pré-existentes mantêm o `default_hourly_rate` original.
- Transação atômica garante que ou tudo persiste (livro + capítulos + estúdio com rate propagado) ou nada.
- O guard "rate placeholder + ownership" evita que um atacante abuse do endpoint para sobrescrever rates de estúdios arbitrários: qualquer estúdio cujo rate já foi propagado (`≠ 0.01`) é rejeitado, e ownership impede acesso a estúdios de outros usuários.

**Alternatives considered**:
- **Sempre propagar (inclusive para estúdios pré-existentes)**: rejeitado porque contradiz a intenção da clarificação e pode sobrescrever valores intencionalmente diferentes.
- **Endpoint separado `PATCH /studios/:id/default-rate-from-book/:bookId`**: rejeitado por introduzir round-trip extra e complicar a atomicidade.
- **Propagação client-side** (dois requests): rejeitado porque perde atomicidade — se o PATCH do estúdio falhasse, o livro já estaria criado com rate propagado apenas "na cabeça" do produtor.

---

## 6. Reversão `paid → completed` com dupla confirmação

**Decision**: `PATCH /api/v1/chapters/:id` com body incluindo `status: "completed"` e flag obrigatória `confirmReversion: true` quando o estado atual é `paid`. Sem o flag, resposta `422 REVERSION_CONFIRMATION_REQUIRED`. UI exibe `AlertDialog` (shadcn) com copy explícita antes de enviar o flag.

**Rationale**:
- Não é uma "mudança financeira" strictu sensu — horas e preço permanecem; apenas o status volta a `completed`, permitindo edição (útil para corrigir marcação errônea de "paid").
- Dupla barreira (UI + backend flag) garante que uma requisição acidental via curl/script também precise enviar o flag explícito.
- Consistência com o helper `recomputeBookStatus`: após a reversão, `book.status` é recomputado — se nenhum outro capítulo estiver `paid`, `price_per_hour` volta a ser editável (FR-037).

**Alternatives considered**:
- **Endpoint separado** `POST /api/v1/chapters/:id/revert-paid`: rejeitado por criar superfície extra; o PATCH cobre o caso com uma flag extra.
- **Sem flag backend, apenas UI**: rejeitado — um cliente que fale direto com a API contornaria o guard.
- **Impedir reversão 100%**: rejeitado pela clarificação Q7 (produtor explicitamente pediu reversão controlada).

---

## 7. Refatoração do schema Drizzle em arquivo-por-entidade

**Decision**: Criar o diretório `src/lib/db/schema/` e quebrar `src/lib/db/schema.ts` em:
- `auth.ts` (user, session, account, verification)
- `user-preference.ts`
- `studio.ts` (com nova coluna `deleted_at`)
- `narrator.ts` (com nova coluna `deleted_at`)
- `editor.ts` (com nova coluna `deleted_at`)
- `book.ts` (novo)
- `chapter.ts` (novo)
- `index.ts` (barrel que re-exporta tudo)

O arquivo `src/lib/db/index.ts` (db client) continua importando `./schema` — a importação resolve para `./schema/index.ts` transparentemente.

**Rationale**:
- Atende FR-052 explicitamente.
- Reduz arquivos grandes: o `schema.ts` atual já está com ~180 linhas só com entidades pré-existentes; adicionar book + chapter o levaria a ~280+.
- Cada arquivo de entidade fica ≤ 60 linhas, seguindo Princípio IV (simplicidade).
- Sem mudança em migrations existentes — apenas reorganização de código-fonte. A próxima migration (para adicionar `deleted_at`, `book`, `chapter`) é gerada com `drizzle-kit generate`.

**Alternatives considered**:
- **Manter em `schema.ts` único**: rejeitado pelo pedido explícito do produtor e pela escala prevista (7 arquivos cabem melhor que 1 gigante).
- **Arquivo por domínio funcional** (ex: `production.ts` agrupando studio+narrator+editor+book+chapter): rejeitado por misturar entidades com diferentes ciclos de mudança.

---

## 8. Máquina de estados do capítulo — enum PostgreSQL vs CHECK constraint

**Decision**: Usar `text` + Zod enum + CHECK constraint em PostgreSQL (não `pgEnum`).

```sql
status text NOT NULL CHECK (status IN ('pending','editing','reviewing','retake','completed','paid'))
```

**Rationale**:
- `pgEnum` do Drizzle cria um tipo enum real no PostgreSQL, o que dificulta adicionar/remover valores depois (migrations frágeis). Adicionar um novo status no futuro exige `ALTER TYPE ... ADD VALUE` que é transacional-restrito em PostgreSQL < 12 e ainda assim requer cuidado.
- `text + CHECK` é mais flexível: uma nova migration pode `DROP CONSTRAINT + ADD CONSTRAINT` com o conjunto atualizado.
- Zod no payload garante validação semântica — o CHECK é a rede de segurança final no DB.
- Valores em `snake_case` sem acentuação (`editing`, `completed`) para compatibilidade com strings SQL sem escapes e previsibilidade em logs.

**Alternatives considered**:
- **pgEnum**: rejeitado pela rigidez de evolução.
- **smallint com mapa 1..6**: rejeitado por perder legibilidade em queries ad-hoc e dumps.

---

## 9. Unicidade de título por estúdio (`UNIQUE (lower(title), studio_id)`)

**Decision**: Criar índice único expression-based: `CREATE UNIQUE INDEX book_title_studio_unique ON book (lower(title), studio_id)`. Esse índice **inclui** livros de estúdios soft-deleted (não tem `WHERE deleted_at IS NULL`), para que reativar um estúdio não cause colisão com títulos que passaram a coexistir.

**Rationale**:
- Case-insensitive via `lower()` permite "Dom Casmurro" e "dom casmurro" serem considerados iguais.
- Indexar em `(lower(title), studio_id)` compõe o constraint: o mesmo título pode coexistir em estúdios diferentes (A4 da spec).
- Trim via application layer (Zod transform `.trim()`) antes do insert/update.

**Alternatives considered**:
- **`citext` column**: rejeitado por exigir extensão `citext` no PostgreSQL, criando fricção com schema-per-worker de E2E.
- **Único por `title` global**: rejeitado pela clarificação A4 (unicidade deve ser por estúdio).

---

## 10. Edição inline de capítulo — UI pattern

**Decision**: Cada linha em `chapters-table.tsx` tem três estados:
1. **view** (padrão): exibe valores + ícones "Editar" e "Excluir" no `RowActions`.
2. **edit**: substitui células por inputs/selects; ícones viram "Cancelar" e "Confirmar".
3. **select** (quando o modo de exclusão em lote está ativo em toda a tela): checkbox substitui qualquer ícone.

Estado por linha é gerenciado pelo `<ChapterRow>` via `useState` local (`"view" | "edit" | "select"`) com prop de override do modo global de exclusão. Edições simultâneas em linhas diferentes coexistem (cada linha é independing).

**Rationale**:
- Reusa a convenção já consolidada em `/studios`, `/narrators`, `/editors`.
- Mantém shape de layout estável (sem mudança de altura/lineshift durante a edição — inputs substituem textos in-place).
- A reversão `paid → completed` abre um `AlertDialog` controlado pelo próprio `<ChapterRow>` quando o produtor tenta confirmar um status-change desse tipo.

**Alternatives considered**:
- **Drawer lateral de edição completa**: rejeitado por quebrar o padrão já usado.
- **Edição em modal**: rejeitado por idem.

---

## 11. Modo de exclusão em lote — ocultação vs desabilitação

**Decision**: Quando o modo está ativo, **ocultar** (`hidden` className condicional) os ícones de edição/exclusão por linha e o botão "Editar livro" no cabeçalho. Substituir o `RowActions` por `<Checkbox disabled={isPaid}>`. A barra superior (`chapters-bulk-delete-bar.tsx`) é `position: sticky` no topo.

**Rationale**:
- Clarificação Q8: o produtor prefere ocultar (interface limpa) a desabilitar (afford sugere que poderia ser clicado em outro contexto).
- Reduz ruído cognitivo do modo especial.
- Capítulos `paid` ficam com checkbox **desabilitado visualmente** (não oculto) — é informação útil ("este existe mas não pode ser removido").

**Alternatives considered**:
- **Desabilitar + tooltip**: rejeitado pela clarificação.
- **Substituir toda a tabela por uma view read-only**: rejeitado por custo e por perder contexto.

---

## 12. Endpoints REST — superfície mínima

**Decision**: Seguir FR-056 com os endpoints abaixo.

| Método | URL | Propósito |
|--------|-----|-----------|
| GET | `/api/v1/books` | Lista todos os livros do produtor autenticado |
| POST | `/api/v1/books` | Cria livro + N capítulos + (opcional) propaga rate para estúdio inline |
| GET | `/api/v1/books/:id` | Livro com capítulos embutidos (single request para detalhes) |
| PATCH | `/api/v1/books/:id` | Edita título/estúdio/valor/hora/quantidade (aumenta capítulos se `numChapters > current`) |
| DELETE | `/api/v1/books/:id` | Remove livro (cascata em capítulos via FK `ON DELETE CASCADE`) |
| POST | `/api/v1/books/:id/chapters/bulk-delete` | Recebe `{ chapterIds: string[] }` e executa exclusão atômica |
| PATCH | `/api/v1/chapters/:id` | Atualiza status/narrador/editor/horas; inclui `confirmReversion?: boolean` |
| DELETE | `/api/v1/chapters/:id` | Remove capítulo individual (cascade-delete livro se último não-`paid` sem `paid` remanescentes) |

**Rationale**:
- Único POST especial (`bulk-delete`) em vez de `DELETE` com body (pouco padrão HTTP) ou múltiplos DELETEs (não atômico).
- `GET /books/:id` retorna o livro já com `chapters` embutidos para evitar N+1 no client — aceitável no MVP pelo volume (≤ 999 capítulos).
- `DELETE /books/:id` só é chamado explicitamente por UI em cenários de "último capítulo removido" — a rota existe porque futuras features podem querê-la.

**Alternatives considered**:
- **GraphQL**: rejeitado por escopo — REST é o padrão do projeto (Princípio X).
- **`GET /chapters?bookId=...`**: rejeitado por preferir resource-nesting (`/books/:id` embutido).

---

## 13. Extensão do schema pré-existente com `deleted_at` e índices parciais

**Decision**: Migration única adiciona:
- `studio.deleted_at`, `narrator.deleted_at`, `editor.deleted_at` (todas `timestamptz NULL`).
- Novos índices parciais: `CREATE INDEX studio_name_unique_active ON studio (lower(name)) WHERE deleted_at IS NULL` (idem para narrator, editor).
- Remove o índice único byte-exato atual e o substitui por índice único case-insensitive parcial, para casar com a regra de desarquive.

Espera-se que o constraint único original seja preservado via migration que faz DROP + CREATE — o SQL é gerado por `drizzle-kit generate` e revisado manualmente antes de `drizzle-kit migrate`.

**Rationale**:
- Índice parcial acelera as listagens (Princípio XI) porque a leitura normal sempre filtra `deleted_at IS NULL`.
- Manter o constraint de unicidade **apenas nos ativos** enquanto permite reciclar nomes históricos soft-deleted **via desarquive** (se alguém tentar usar o mesmo nome, cai no fluxo de reativação do registro histórico em vez de ganhar outro registro).

**Alternatives considered**:
- **Único global (incluindo soft-deleted)**: rejeitado porque bloquearia criação legítima de um registro novo quando um soft-deleted já "guarda" o nome (contradiz Q9 do desarquive).
- **Sem constraint de unicidade, apenas validação application-side**: rejeitado por aceitar corrida — duas criações simultâneas passariam pela validação antes de qualquer uma persistir.

---

## 14. Estratégia de testes — cobertura por camada

**Decision**: Priorizar testes unit para lógica pura e services (state machine, `computeBookStatus`, serviços com repos fakes), integration para regras que dependem do banco (transações multi-tabela, soft-delete + desarquive, unicidade), e E2E para os fluxos operacionais completos (criar livro com estúdio inline, editar capítulo, exclusão em lote, PDF popover). Cobertura mínima 80% geral, 100% em `computeBookStatus` e `isValidTransition`.

**Rationale**:
- Lógica pura é testável em milissegundos sem DB — unit tests são o ambiente certo (Princípio V).
- Transações atômicas exigem DB real — BEGIN/ROLLBACK em integration cobre com isolamento.
- Fluxos completos (UI + server + DB) só se validam em E2E com Playwright.
- Factories (`createTestBook`, `createTestChapter`) em `__tests__/helpers/factories.ts` — nunca em `seed-test.ts` (Princípio V "Factory, não seed").

**Alternatives considered**:
- **Tudo em E2E**: rejeitado por custo de execução e dificuldade de cobrir edge-cases.
- **Apenas unit**: rejeitado — integração banco + transação não pode ser mockada de forma fidedigna.

---

## 15. Tratamento de cascade delete quando último capítulo é excluído

**Decision**: O service `deleteChapter(chapterId, tx)` verifica após exclusão se `SELECT COUNT(*) FROM chapter WHERE book_id = :bookId = 0`. Se sim, executa `DELETE FROM book WHERE id = :bookId` na mesma transação. Resposta API: `204 No Content` com header `X-Book-Deleted: true` para o client saber que precisa redirecionar para `/books`.

O mesmo padrão aplica-se a `bulkDeleteChapters` — após o DELETE em lote, verifica contagem final; se zero, remove o livro.

**Rationale**:
- Atomicidade exige que a checagem aconteça pós-DELETE dos capítulos mas dentro da transação.
- Header custom sinaliza ao client o efeito colateral sem inventar um novo body.

**Alternatives considered**:
- **Trigger SQL `AFTER DELETE ON chapter`**: rejeitado pelo princípio de manter regra no service.
- **Client envia um DELETE ao livro depois de ver `204`**: rejeitado por round-trip extra e janela de inconsistência.

---

## 16. Libraries consultadas via Context7 MCP

Consultas previstas na fase de implementação (Princípio XV — obrigatório antes de usar qualquer API):

- **Drizzle ORM 0.45**: `relations()`, composite unique indexes com `lower()`, transactions, migrations workflow `generate → migrate`.
- **Next.js 16.2.1**: App Router Server Components + Route Handlers, `revalidatePath`, `next/cache`, streaming.
- **better-auth 1.5**: como estender session context para validar owner em operações mutáveis.
- **Zod 4.3**: `z.string().trim().min(1)`, `superRefine` para regras transacionais (ex: `confirmReversion` quando status = paid).
- **React Hook Form 7.72** + `@hookform/resolvers/zod` 5.2.2: padrão de controlled fields com validação Zod, `useFieldArray` se necessário.
- **shadcn/ui 4.1**: AlertDialog (reversão), Dialog (modais de livro), Popover (PDF), Checkbox, Command (combobox de estúdio — `<Popover>` + `<Command>` para busca por nome + opção "+ Novo Estúdio" ao final do `<CommandList>` que abre o subformulário inline sem fechar o modal; escolhido sobre `<Select>` nativo porque este não tem campo de busca e a base de estúdios pode crescer), Tooltip (explicações em campos bloqueados).
- **@tanstack/react-table 8.21**: column sorting, row selection (modo exclusão).
- **Playwright**: schema-per-worker já configurado; apenas adicionar specs.

---

## 17. Design reference via Pencil MCP

**Decision**: Antes de construir o `book-header.tsx` e os componentes de detalhe, consultar `design.pen` via Pencil MCP usando o Node ID `YeFYS` (tela de detalhes do livro). Outros nós relevantes (listagem, modal de criação) serão resolvidos por similaridade com `/studios`, `/editors`, `/narrators` — já consolidados no design system. Essa consulta acontece na fase `/speckit-tasks` ou durante `/speckit-implement`, não aqui.

**Rationale**: Princípio VII exige design.pen como referência para telas novas. Consultar antes da codificação evita retrabalho.

---

## Consolidated decision index

| # | Decisão | FR/Story vinculado |
|---|---------|--------------------|
| 1 | `book.status` cache materializado | FR-019, A1 |
| 2 | Soft-delete unificado | FR-046, FR-047, FR-048, A3 |
| 3 | Desarquive automático por colisão | FR-046a, FR-047a, FR-048a |
| 4 | Regra de precedência `computeBookStatus` | FR-019, US5.13, US5.14 |
| 5 | Propagação transacional de rate | FR-012, FR-012a, US3 |
| 6 | Reversão `paid → completed` com flag | FR-026, US5.7, US5.8 |
| 7 | Schema Drizzle arquivo-por-entidade | FR-052 |
| 8 | Status como `text + CHECK` | FR-025 (implementação) |
| 9 | Unicidade `UNIQUE (lower(title), studio_id)` | FR-015, A4 |
| 10 | Edição inline — 3 estados de linha | FR-023, FR-024, US5 |
| 11 | Ocultar ícones em modo exclusão | FR-030, FR-031, US7 |
| 12 | Endpoints REST superficiais | FR-056 |
| 13 | Migrations aditivas de `deleted_at` + índice parcial | FR-046/047/048 |
| 14 | Cobertura por camada | Princípio V, SC-010 |
| 15 | Cascade delete do livro quando capítulos zeram | FR-028, FR-033 |

Todas as decisões acima são entrada direta para `data-model.md`, `contracts/*` e `quickstart.md` na próxima fase.
