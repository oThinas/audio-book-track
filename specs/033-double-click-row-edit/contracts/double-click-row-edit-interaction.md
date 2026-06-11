# UI Interaction Contract: Double-Click Row Edit

**Feature**: 033-double-click-row-edit | **Date**: 2026-06-10

> Esta feature não expõe contrato HTTP/REST. O "contrato" é a **interação de UI** entre o usuário e a linha da tabela de capítulos. Define gatilhos, alvos e resultados observáveis — base para os testes E2E.

## Superfície

Tabela de capítulos em `/books/[id]`, cada linha (`[data-testid="chapter-row-<id>"]`) em `data-mode="view"`.

## Gatilho: duplo-clique em célula de dado

| Célula (view) | `activateField` | Resultado observável ao entrar em edição |
|---|---|---|
| Título | `"title"` | `data-mode="edit"`; input de título (`[data-testid="chapter-title-<id>"]`) **focado**. |
| Status (badge) | `"status"` | `data-mode="edit"`; dropdown de status (`[data-testid="chapter-status-<id>"]`) **aberto** (listbox visível). |
| Narrador | `"narrator"` | `data-mode="edit"`; dropdown de narrador (`[data-testid="chapter-narrator-<id>"]`) **aberto**. |
| Editor | `"editor"` | `data-mode="edit"`; dropdown de editor (`[data-testid="chapter-editor-<id>"]`) **aberto**. |
| Prazo | `"deadline"` | `data-mode="edit"`; popover do calendário (`[data-testid="chapter-deadline-<id>"]`) **aberto**. |
| Horas editadas | `"editedSeconds"` | `data-mode="edit"`; input de horas (`[data-testid="chapter-hours-<id>"]`) **focado**. |

## Gatilho: duplo-clique em célula não-dado

| Célula | Resultado |
|---|---|
| Alça de arrastar (`chapter-drag-<id>`) | Nenhum (ignorado). |
| Checkbox de seleção (`chapter-select-<id>`) | Nenhum (ignorado). |
| Coluna Ações (lápis/excluir/mover) | Nenhum (botões respondem ao clique simples normal). |

## Regras de bloqueio e modo

| Condição | Comportamento |
|---|---|
| Capítulo `paid` + duplo-clique em **Título, Narrador, Editor, Prazo ou Horas** (`PAID_LOCKED_FIELDS`) | Entra em `data-mode="edit"`; a ativação é **pulada** — o controle não é focado/aberto. |
| Capítulo `paid` + duplo-clique em **Status** | Entra em edição e **abre** o dropdown (único campo editável em `paid` — reversão `paid` → `completed`). |
| Tabela em **modo seleção** (`data-testid="chapter-select-all"` presente) | Duplo-clique em qualquer célula é **no-op** — a linha permanece exibindo o checkbox. |
| Linha **já em edição** | Duplo-clique sobre controles não tem comportamento adicional (interação normal do controle). |

## Invariantes (não-regressão)

- O botão de lápis (`chapter-edit-<id>`) continua entrando em edição **sem** ativar nenhum controle automaticamente, e continua acessível por teclado (Tab + Enter).
- Salvar (`chapter-confirm-<id>`), cancelar (`chapter-cancel-<id>`), validação de título, reversão de `paid` e reordenação permanecem inalterados.
- O duplo-clique não deixa resíduo de seleção de texto nativa na célula.
- Nenhuma requisição de rede é disparada pela entrada em edição (apenas no salvamento, como hoje).

## Acessibilidade

- O duplo-clique é um **acelerador de mouse** aditivo; não é o único caminho de edição.
- Usuários de teclado/leitor de tela usam o lápis. Nenhuma mudança em roles/ARIA dos controles existentes.
