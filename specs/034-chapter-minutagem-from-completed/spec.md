# Feature Specification: Minutagem obrigatória a partir de "Concluído"

**Feature Branch**: `034-chapter-minutagem-from-completed`

**Created**: 2026-06-11

**Status**: Implemented

**Type**: Business-rule change (mini-spec) + constitution amendment

**Input**: User description: "Quero alterar uma regra de negócio importante: o capítulo pode ganhar minutagens a partir do status 'concluído'. Pode acontecer o cenário: capítulo tem 1h e vai para revisão → revisão reprova → capítulo tem 1h10 e vai para revisão → revisão aprova; será que o usuário atualizou a minutagem? Para não correr esse risco, os operadores só preenchem a minutagem após ser aprovado da revisão (concluído em diante). Ainda assim, deixar opcional preencher a minutagem quando o capítulo vai para 'em revisão', caso o operador queira ter uma ideia de quanto irá receber quando o capítulo for pago. Como é regra de negócio chave, atualizar a constitution.md, remover bloqueios etc. Garantir que a regra seja aplicada no frontend e no backend sem resquícios."

## Problem

A regra anterior exigia `edited_seconds > 0` para o capítulo **entrar em `em revisão`**
(`editing → reviewing`). Isso cria risco de dado financeiro **defasado**:

> capítulo tem 1h → vai para revisão → revisão **reprova** → re-editado para 1h10 →
> volta para revisão → revisão **aprova**. A minutagem registrada (1h) pode nunca ter
> sido atualizada para 1h10 antes da aprovação.

Como a minutagem alimenta a fórmula de ganho (Princípio II da constituição), um número
provisório registrado cedo demais pode virar pagamento incorreto.

## Decision

A minutagem (`edited_seconds`) só se torna **obrigatória ao concluir** — o ponto em que a
revisão foi aprovada e o número é final. Em `em revisão` o preenchimento é **opcional**
(prévia do ganho). O **editor continua obrigatório** para entrar em revisão.

Decisões confirmadas com o usuário:
1. A minutagem permanece **editável em qualquer status exceto `paid`** — sem bloqueio em
   `pending`/`editing`. Apenas o *portão de obrigatoriedade* muda.
2. **Editor segue obrigatório** para `editing → reviewing`.
3. Conduzido como **implementação direta com TDD + emenda à constituição** (sem cerimônia
   speckit completa). Este documento é o registro canônico ("mini-spec") da mudança.

## Rule change

| Transição | Antes | Depois |
|---|---|---|
| `editing → reviewing` | editor **e** `edited_seconds > 0` | **apenas editor** (minutagem opcional) |
| `reviewing → completed` | sem validação de minutagem | **`edited_seconds > 0` obrigatório** |

Minutagem por status: **opcional/provisória** em `reviewing`/`retake`; **definitiva
(obrigatória `> 0`)** ao entrar em `completed`; **imutável** em `paid`.

## Error codes

A rejeição única antiga foi **dividida em duas**:

| Antes (removido) | Depois (adicionados) | Status | Quando |
|---|---|---|---|
| `CHAPTER_EDITOR_OR_SECONDS_REQUIRED` | `CHAPTER_EDITOR_REQUIRED` | 422 | `editing → reviewing` sem editor |
| | `CHAPTER_EDITED_SECONDS_REQUIRED` | 422 | `reviewing → completed` com `edited_seconds = 0` |

Mensagens PT-BR (catálogo `src/lib/api/error-codes/chapter.ts`):
- `CHAPTER_EDITOR_REQUIRED`: "É preciso atribuir um editor antes de enviar para revisão."
- `CHAPTER_EDITED_SECONDS_REQUIRED`: "É preciso registrar a minutagem (tempo editado, acima de zero) antes de concluir o capítulo."

## Scope of changes

**Backend** (origem única + ramificações):
- `src/lib/domain/chapter-state-machine.ts` — divisão da rejeição; checagem de segundos movida para `reviewing → completed`.
- `src/lib/domain/chapter-transitions.ts` — mensagens PT-BR dos dois novos motivos.
- `src/lib/errors/chapter-errors.ts` — `ChapterEditorRequiredError` + `ChapterEditedSecondsRequiredError` (no lugar de `ChapterEditorOrSecondsRequiredError`).
- `src/lib/api/error-codes/chapter.ts` — dois codes novos no catálogo.
- `src/lib/services/chapter-service.ts` — `assertTransition` mapeia os dois motivos.

**Frontend**: nenhuma mudança de código. `apiFetch` resolve o toast PT-BR pelo catálogo
`errorCodes`; a minutagem já é editável (exceto `paid`); a validação das transições segue
server-authoritative.

**Docs / fonte da verdade**:
- `.specify/memory/constitution.md` — tabela do ciclo de vida, nota de transição (minutagem opcional em revisão / obrigatória ao concluir), nota do KPI 4.
- `CLAUDE.md` — bullets de `reviewing` e `completed`.

## Verification

- `bun run lint` — limpo.
- `bun run test:unit` — 1295/1295 (state machine, transitions, service, error classes).
- `bun run test:integration` — 323/323 (inclui 422 `CHAPTER_EDITED_SECONDS_REQUIRED` em `reviewing → completed` sem minutagem e `editing → reviewing` 200 só com editor).
- `bun run test:e2e chapters-edit-inline` — 3/3 (fluxo de transição afetado).
- `bun run build` — compila.
- Grep de resquícios em `src/` e `__tests__/` (`EDITOR_OR_SECONDS`, `ChapterEditorOrSeconds`) → zero.

## Supersedes / Notas históricas

As specs históricas abaixo **permanecem intactas** (registro point-in-time do que cada
feature entregou). Os trechos a seguir ficam **superados por esta 034** — consultar este
documento e a constituição como fonte da verdade atual:

- **`specs/020-books-chapters-crud/`** — atualizada nesta mudança (é o spec canônico do
  capítulo): `spec.md` cenários 3 e 6, `FR-025`, e `contracts/chapters.md`.
- **`specs/023-global-error-handler/`** *(não editada)* — `contracts/error-codes.md:45`,
  `data-model.md:38,91,144` e `research.md:281` referenciam o code antigo
  `CHAPTER_EDITOR_OR_SECONDS_REQUIRED`. Substituído por `CHAPTER_EDITOR_REQUIRED` +
  `CHAPTER_EDITED_SECONDS_REQUIRED`.
- **`specs/025-chapter-deadline/`** *(não editada)* — `contracts/api-chapter-update.md:84`
  lista o code antigo entre as respostas 422 "inalteradas". Vale a tabela de error codes
  desta 034.
