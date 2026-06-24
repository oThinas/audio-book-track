# Contract: Diagnostics Scripts (Lighthouse + React Doctor)

**Feature**: 039-perf-audit-vercel-analytics

Scripts operacionais sob demanda — **fora** da suíte de testes automatizada. Produzem o relatório de baseline (US3).

---

## C1 — `scripts/diagnostics/lighthouse.ts`

**Entrada (pré-condições)**:
- App em **build de produção** rodando localmente via `next start` (porta conhecida; `BETTER_AUTH_URL`/`DATABASE_URL` apontando a uma base local).
- Base seedada de forma **determinística** com o admin **e ≥1 livro com capítulos** (via `scripts/diagnostics/seed.ts` reusando `createTestBook`) — necessário para auditar `/books`, `/books/:id` e o modal.
- Chromium do Playwright disponível (lançado standalone, fora do test runner).

**Comportamento**:
1. Loga via o fluxo E2E reutilizado (`login(page)` — admin/admin123 em `/login`).
2. Para cada página-chave roda Lighthouse:
   - **Navigation mode**: `/` (home pública), `/login`, `/dashboard`, `/books`, `/books/:id`.
   - **Snapshot/timespan mode**: modal de configuração — abre via navegação soft (clicar o gatilho que aciona a intercepting route `@modal/(.)settings`), então audita o estado interceptado (não a URL `/settings` direta).
3. Perfis **mobile** e **desktop**; **tema único**.
4. Coleta as 4 categorias: Performance, Acessibilidade, Boas Práticas, SEO.

**Saída**:
- Artefatos brutos (JSON/HTML) → `.lighthouse/` (gitignored).
- Resumo de scores consumível pelo relatório curado em `docs/diagnostics/`.

**Invocação**: `bun run diagnose:lighthouse`.

---

## C2 — `scripts/diagnostics/react-doctor.ts`

**Comportamento**:
- Executa `bunx react-doctor@latest` (scanner estático) na raiz do projeto.
- Standalone (projeto usa Biome, não ESLint/oxlint — sem leitura de config de lint).
- Sem instalar dependência; sem integração GitHub Action (fora de escopo).

**Saída**: achados nas 6 categorias (segurança, performance, estado, efeitos, arquitetura, acessibilidade), consumíveis pelo relatório curado.

**Invocação**: `bun run diagnose:react`.

---

## C3 — Baseline duplo (SC-004 / FR-013)

| Execução | Quando | Propósito |
|---|---|---|
| **Pré** | Antes de montar a telemetria (foto limpa do app) | Linha de base de scores e first-load JS |
| **Pós** | Depois de montar a telemetria, **com ela HABILITADA** (`VERCEL_ENV=production` local) | Comprovar delta: CLS = 0, first-load JS < 5 kb gzipped, carga não-bloqueante |

> ⚠️ A captura **Pós** precisa ser feita com a telemetria **ativa**. O gating é Server Component que renderiza `null` fora de produção, então uma build gateada-off teria o mesmo bundle do Pré (delta 0) e **não** mediria o peso real. Forçar `VERCEL_ENV=production` na build/run local expõe os chunks da telemetria.

A comparação dos dois runs é registrada na seção "Delta de instrumentação" do relatório.

---

## C4 — Relatório curado

| Propriedade | Valor |
|---|---|
| Local | `docs/diagnostics/<YYYY-MM>-baseline.md` |
| Natureza | Snapshot **datado e imutável** (novos runs criam novos arquivos, não sobrescrevem) |
| Versionado | Apenas o resumo curado (scores + achados priorizados + delta) |
| Não versionado | Artefatos brutos (`.lighthouse/`) |
| Regenerável | Via `bun run diagnose:lighthouse` + `bun run diagnose:react` (FR-015) |

---

## C5 — `package.json` scripts (contrato de comandos)

```jsonc
{
  "scripts": {
    "diagnose:seed": "bun run scripts/diagnostics/seed.ts",
    "diagnose:lighthouse": "bun run scripts/diagnostics/lighthouse.ts",
    "diagnose:react": "bun run scripts/diagnostics/react-doctor.ts",
    "diagnose": "bun run diagnose:seed && bun run diagnose:lighthouse && bun run diagnose:react"
  }
}
```
