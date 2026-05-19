# Quickstart — Validação Manual da Feature

Roteiro para validar a feature em desenvolvimento local após a implementação. Cobre os fluxos das 7 user stories da spec.

## Pré-requisitos

1. **Banco local rodando** (PostgreSQL via `docker compose up -d` ou similar).
2. **Migrations aplicadas** com o novo schema:
   ```bash
   bun run db:generate   # gera a migration que adiciona completed_at, paid_at, dashboard_widgets
   bun run db:migrate    # aplica
   ```
3. **Seed mínimo executado**:
   ```bash
   bun run db:seed       # cria admin + dados sintéticos para o dashboard ter o que mostrar
   ```
4. **shadcn Chart instalado** (uma vez):
   ```bash
   bunx --bun shadcn@latest add chart
   ```
5. **Dev server rodando**:
   ```bash
   bun run dev
   ```

## Fluxo 1 — Acesso inicial (US1)

1. Abrir <http://localhost:3000/dashboard> sem estar logado → deve redirecionar para `/login`.
2. Logar com o admin do seed.
3. Após login, deve ir automaticamente para `/dashboard`.
4. Sem nenhuma configuração prévia, todos os 9 widgets aparecem:
   - **Financeiro**: KPIs "A receber agora", "Receita realizada no período", "Ticket médio" + 3 rankings em tabs.
   - **Operacional**: funil de 6 status + card "Capítulos atrasados".
   - **Retrospectiva**: gráfico de linha.
5. KPI "A receber agora" mostra a soma esperada (verificar contra query SQL manual sobre capítulos `completed`).

**Expected**: tudo carrega em < 2s; LCP < 1s (skeletons aparecem instantaneamente).

## Fluxo 2 — Filtro de período (US2)

1. No filtro do topo, está selecionado "Este mês" por padrão.
2. URL deve ter algo como `?preset=this-month` (ou sem param e o default toma conta).
3. Trocar para "Este ano" → URL atualiza para `?preset=this-year`. KPI "Receita realizada no período" recalcula em < 1s.
4. Clicar no botão de range customizado → DateRangePicker abre. Escolher `01/01/2026` a `31/01/2026` → URL vira `?from=2026-01-01&to=2026-01-31`. KPI recalcula.
5. Refresh F5 → estado preservado (URL é fonte da verdade).
6. Compartilhar URL com outro admin em outro browser → ele vê o mesmo recorte.

**Expected**: todas as transições suaves, sem flash de página inteira. Apenas as seções afetadas re-renderizam.

## Fluxo 3 — Funil e atrasados (US3)

1. **Funil**: contagens batem com `SELECT status, COUNT(*) FROM chapter GROUP BY status` (após filtrar capítulos do seed).
2. Card "Capítulos atrasados" mostra a contagem correta (capítulos com `deadline < hoje` em status ∈ pending/editing/reviewing/retake).
3. Clicar em "Ver lista" → navega para `/books/<id>?focus=week` onde `<id>` é o livro com o capítulo de `deadline` mais antigo.
4. Na página do livro, o filtro "Foco da semana" está ativo (toggle on) e a tabela mostra os capítulos atrasados.
5. Setar `deadline` de todos os capítulos para o futuro → recarregar `/dashboard` → contagem vira 0 e botão "Ver lista" fica desabilitado.

**Expected**: navegação direta, sem rota nova; mismatch entre "atrasado" e "esta semana" é tolerado porque `isInFocusWeek` já inclui `deadline < hoje`.

## Fluxo 4 — Gráfico temporal (US4)

1. Filtro "Hoje" → gráfico mostra 1 ponto (granularidade `day`).
2. Filtro "Este mês" → gráfico mostra ~30 pontos, granularidade `day` (≤ 31 dias).
3. Filtro "Este trimestre" → gráfico mostra ~13 pontos, granularidade `week`.
4. Filtro "Este ano" → gráfico mostra 12 pontos, granularidade `month`.
5. Buckets sem receita aparecem com valor 0 (linha contínua).
6. Hover sobre um ponto → tooltip mostra label PT-BR e BRL formatado.
7. Período sem qualquer pagamento → gráfico mostra estado vazio "Sem receita no período selecionado".

**Expected**: granularidade muda sozinha; nenhuma escolha de toggle do usuário.

## Fluxo 5 — Rankings (US5)

1. Tab "Por estúdio" ativa por padrão. Lista top 10 ordenado por receita descendente.
2. Trocar para "Por narrador" → tab muda, ranking recalcula. Capítulos sem narrador não entram.
3. Trocar para "Por editor" → idem para editor.
4. Verificar que estúdio/narrador/editor soft-deletado (criar um, depois excluir) que contribuiu com receita no período aparece com badge "(arquivado)".

**Expected**: 3 tabs, top 10 cada, sem capítulos órfãos.

## Fluxo 6 — Configuração de widgets (US6)

1. Ir em `/settings`. Rolar até a seção "Dashboard".
2. Visualizar 9 checkboxes, todos marcados, cada um com título e descrição em PT-BR.
3. Desmarcar "Ranking por editor" → clicar em "Salvar" → toast informativo curto OK (não verde de sucesso) OU a UI reflete (checkbox permanece desmarcado após refresh) — preferência pelo padrão da feature 021.
4. Voltar para `/dashboard` → tab "Por editor" não aparece nos rankings; "Por estúdio" e "Por narrador" continuam.
5. Verificar no Network tab que `/api/v1/dashboard/financial` foi chamado SEM o widget `ranking-editor` (otimização FR-032).
6. Desmarcar **todos** os 9 → recarregar `/dashboard` → ver estado vazio com link para `/settings`.
7. Marcar todos de volta → estado restaurado.
8. Logar com outro admin → ele vê o dashboard com a sua própria configuração (default ou prévia), sem afetar a do primeiro.

**Expected**: persistência por usuário; nenhuma config global; otimização de queries quando widgets estão off.

## Fluxo 7 — Edge cases

1. **URL inválida**: abrir `/dashboard?preset=invalid` → fallback silencioso para "Este mês".
2. **Range invertido**: tentar `?from=2026-12-31&to=2026-01-01` no input → DateRangePicker bloqueia client-side; se entrar via URL, retorna 422 com mensagem PT-BR.
3. **Range muito grande**: `?from=2020-01-01&to=2030-12-31` → gráfico mensal renderiza, performance < 5s.
4. **Capítulo legado**: criar capítulo manualmente no DB com `status='paid'` e `paid_at IS NULL` → recarregar dashboard → KPI ignora (porque a fonte é `paid_at`). Mas o backfill da migration deveria ter preenchido esse capítulo se ele já existia ao deploy.
5. **Dark mode**: alternar tema → todos os widgets respeitam tokens; tooltip de chart também.
6. **Mobile (375px)**: layout colapsa em 1 coluna; gráfico encolhe; tabs continuam clicáveis; filtro fica sticky no topo.

## Smoke test rápido (1 minuto)

```bash
# 1. Health check do banco
curl -s http://localhost:3000/api/health | jq

# 2. Endpoint financeiro (sessão necessária — usar cookie do login)
curl -s -H "Cookie: <session-cookie>" \
  'http://localhost:3000/api/v1/dashboard/financial?preset=this-month' | jq '.data | keys'

# Deve retornar:
# [
#   "aReceberAgoraCents",
#   "chaptersPagosCount",
#   "computedWidgets",
#   "periodo",
#   "rankingEditor",
#   "rankingEstudio",
#   "rankingNarrador",
#   "receitaPeriodoCents",
#   "ticketMedioCents"
# ]
```

## Checklist final pré-PR (Princípio XVI)

```bash
bun run lint              # zero erros/warnings
bun run test:unit         # toda a suíte passando
bun run test:integration  # toda a suíte passando
bun run test:e2e          # cobre os 4 cenários de dashboard
bun run build             # build de produção sem erros
```
