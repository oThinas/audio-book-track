# Research: Remoção do campo e-mail de Narradores

**Feature**: 017-narrator-remove-email
**Date**: 2026-04-17
**Status**: Complete — zero `NEEDS CLARIFICATION` pendentes

## Escopo

Esta feature é um refactor destrutivo de remoção de campo em uma entidade existente (`narrator`) introduzida em `015-narrators-crud`. Não há novas libs, novas camadas, novos padrões ou integrações. Toda a stack já está em uso no projeto. A seção de pesquisa existe para ancorar decisões pequenas que podem surgir durante a implementação.

---

## R1 — Forma da migração Drizzle (drop column + swap unique index)

**Decisão**: Usar `drizzle-kit generate` após alterar `src/lib/db/schema.ts` para (a) remover a coluna `email`, (b) remover o `uniqueIndex("narrator_email_unique")` e (c) adicionar `uniqueIndex("narrator_name_unique").on(table.name)`. A migração SQL gerada deve conter:

```sql
DROP INDEX "narrator_email_unique";
ALTER TABLE "narrator" DROP COLUMN "email";
CREATE UNIQUE INDEX "narrator_name_unique" ON "narrator" ("name");
```

Aplicar com `bun run db:migrate` (script customizado que chama `drizzle-orm/node-postgres/migrator`).

**Rationale**:
- O projeto proíbe `drizzle-kit push` (Princípio XI): toda mudança DEVE passar por arquivo de migração versionado em `drizzle/` com journal atualizado.
- `DROP INDEX` antes do `DROP COLUMN` é a ordem canônica para evitar que o índice referencie coluna inexistente, embora o PostgreSQL moderno aceite drop em qualquer ordem.
- Não é necessária instrução `IF EXISTS` — o journal garante que a migração roda apenas uma vez.

**Alternativas consideradas**:
- *SQL artesanal fora do drizzle-kit*: rejeitado — foge do fluxo padrão e desincroniza o journal.
- *Marcar coluna como nullable em vez de dropar*: rejeitado — o produto pediu remoção, não deprecação; manter coluna órfã acumula dívida técnica sem benefício.
- *Migração em duas etapas (nullable → drop)*: rejeitado — volume de dados é trivial (dezenas de registros em dev, produção não existe ainda); downtime inexiste.

---

## R2 — Comportamento do schema Zod ao receber `email` legado

**Decisão**: Remover o campo `email` dos schemas Zod (`narratorFormSchema`, `createNarratorSchema`, `updateNarratorSchema`). Não adicionar `.strict()` — o comportamento padrão do Zod é **descartar silenciosamente** chaves extras no `parse`. Payloads antigos com `{ name, email }` passam como válidos, persistem apenas `name`, e o campo `email` é ignorado.

**Rationale**:
- Atende ao FR-006 ("DEVE aceitar payloads contendo apenas `name` e DEVE ignorar qualquer campo `email` enviado sem retornar erro").
- Zero mudança no handler HTTP além de remover o import do erro extinto.
- Evita quebrar clientes legados (se existirem) — fail-open é preferível em APIs internas em fase inicial.

**Alternativas consideradas**:
- *`.strict()` para rejeitar `email` com 422*: rejeitado — a spec pede silenciar, não quebrar. Strict mode seria útil em APIs públicas versionadas.
- *Logar warning quando `email` chega*: rejeitado — API é interna, over-engineering.

---

## R3 — Tratamento de `unique violation` no repository (realocado para `name`)

**Decisão**: Manter `POSTGRES_UNIQUE_VIOLATION`, `hasUniqueViolationCode`, `isUniqueViolation` e os blocos `try/catch` em `DrizzleNarratorRepository.create` e `.update`. A constraint única agora é em `name` — o mecanismo é idêntico, apenas troca a classe de erro lançada de `NarratorEmailAlreadyInUseError` para `NarratorNameAlreadyInUseError`.

**Rationale**:
- A constraint única continua existindo (em `name`); sem o try/catch, um POST/PATCH com nome duplicado vazaria o erro bruto do PostgreSQL para o cliente e retornaria `500`.
- Princípio X exige respostas de erro estruturadas — o mapeamento SQL→erro de domínio continua necessário.

**Alternativas consideradas**:
- *Validar unicidade apenas no service via `findByName`*: rejeitado — race condition clássica (dois requests concorrentes passam pela checagem, ambos inserem, um falha no banco e retorna `500`). A constraint + catch é a única defesa correta.
- *Extrair helpers para `lib/db/postgres-errors.ts` compartilhado*: aceitável no futuro, mas fora de escopo — ninguém mais usa hoje.

---

## R4 — Recalibração do layout da tabela após remoção de coluna

**Decisão**: Avaliar visualmente em dev após implementação; ajustar apenas se necessário. A tabela atual é renderizada por `@tanstack/react-table` + shadcn `<Table>` com larguras flexíveis (`w-full` + células `flex-1` / `w-auto`). Remover uma coluna tende a redistribuir espaço automaticamente. Se o resultado for feio em mobile ou desktop, limitar a coluna "Nome" a `max-w-xl` ou similar via Tailwind — sem hardcoded colors ou paddings.

**Rationale**:
- Princípio VII (Frontend) e IX (Design Tokens) proíbem valores visuais hardcoded fora de tokens.
- Testes E2E de responsividade (`narrators-responsive.spec.ts`) e font-size (`narrators-font-size.spec.ts`) já cobrem regressões — basta mantê-los verdes.

**Alternativas consideradas**:
- *Adicionar coluna "Ações" expansível para compensar*: rejeitado — muda escopo; fora do pedido do usuário.

---

## R5 — Ordem das tasks para TDD com suíte existente

**Decisão**: Atualizar testes primeiro em todas as camadas (schemas, service, repositories, API unit, integration, E2E), rodar suíte para confirmar que falham contra o código atual, depois alterar código de produção da camada mais interna para a mais externa (schema DB → domain → repository → service → API route → UI → seed).

**Rationale**:
- Princípio V exige testes falhando antes da mudança.
- Começar pela camada mais interna (schema DB) minimiza cascata de erros de tipo TypeScript — `Narrator` sem `email` força o compilador a apontar todos os call-sites que ainda referenciam o campo.

**Alternativas consideradas**:
- *Alterar tudo em um commit grande e depois corrigir testes*: rejeitado por violar TDD.
- *Fazer camada por camada com commit separado*: aceitável, recomendado (`/conventional-commits` pode ajudar), mas não obrigatório — a task list do `/speckit.tasks` cuidará do recorte granular.

---

## R6 — Normalização de `name` para unicidade

**Decisão**: Aplicar **apenas `trim()` nas pontas**, sem `toLowerCase()` e sem normalização Unicode (NFC/NFD). Duas entradas que diferem apenas em capitalização, acentos ou espaços internos duplicados são consideradas nomes **distintos**. O índice PostgreSQL em `text` já é case-sensitive e byte-exact, o que combina naturalmente com essa regra.

**Rationale**:
- Evita surpresas culturais — nomes próprios brasileiros podem intencionalmente ter capitalização própria ou espaços estilizados.
- Simplifica a implementação: o Zod schema já aplica `.trim()`, o repository não precisa de pós-processamento.
- Se um dia o produto pedir "Ana" e "ana" como mesmo narrador, isso é uma feature incremental (podemos usar `CREATE UNIQUE INDEX ... ON (lower(name))`, ou column generated). Fora de escopo hoje.

**Alternativas consideradas**:
- *Case-insensitive via `lower(name)` no índice*: rejeitado — adiciona complexidade a mais do que o produto pediu.
- *Collapse de espaços internos via regex*: rejeitado pelo mesmo motivo.

---

## Resumo de riscos

| Risco | Mitigação |
|-------|-----------|
| Banco produtivo com dados reais é corrompido pela migração | Produção não existe hoje. Se existir no momento do merge, usuário exporta dados antes (fora de escopo). |
| Testes E2E flakeiam após mudança de layout | Playwright `globalSetup` + schema-per-worker já oferecem isolamento; locators baseados em `data-testid` (ex: `narrator-email`) DEVEM ser removidos — revisar durante implementação. |
| Migração aplicada sem o código correspondente no mesmo deploy | Deploy unificado (DB migration + novo código no mesmo release); atípico este projeto ainda não ter pipeline formal. |
| Schemas Zod aceitam `email` extra por inadvertência e passam adiante | Descartado — Zod default drop de chaves extras; teste unit verifica que output não contém `email`. |
| Base de dev tem dois narradores com o mesmo `name` antes da migração | `CREATE UNIQUE INDEX` falha com mensagem clara; dev deduplica (`DELETE`) e retenta. Documentado em quickstart. |
| Race condition em POSTs concorrentes com mesmo `name` | Constraint única + catch de `unique_violation` no repository cobre; sem try/catch, vazaria `500`. |

---

## Conclusão

Todas as decisões pequenas foram resolvidas. Nenhuma dúvida bloqueadora. Feature pronta para `/speckit.tasks`.
