# Quickstart: verificar a Sessão 1 (D6 + D7 + D8)

Pré-requisito: build de produção + sessão de admin semeada (fluxo de diagnóstico existente).

```bash
bun run build
bun run start            # http://localhost:3000 (ou DIAGNOSE_BASE_URL)
# em outro terminal:
bun run diagnose:seed
bun run diagnose         # seed + lighthouse + react-doctor
```

## Verificar cada Success Criterion

### D7 — SEO = 100 (SC-001)

- `bun run diagnose:lighthouse` → todas as páginas (login, dashboard, books, books-detail),
  mobile e desktop, com `seo=100`.
- Nos relatórios `.lighthouse/*.json`: audit `robots-txt` = pass **e** `is-crawlable` = pass.
- `curl -s http://localhost:3000/robots.txt` → `User-Agent: *` / `Allow: /`, acessível sem sessão.

### D6 — sem side effect em GET + logout funcional (SC-002, SC-003)

- `bun run diagnose:react` (`react-doctor --verbose`) → **zero** "Side effect in GET handler".
- `GET /api/auth/clear-session` retorna **404** (rota deletada).
- `bun run test:e2e` → `auth/logout.spec.ts` e `settings-preferences.spec.ts` verdes
  (logout via `/login?reauth=1`).
- `bun run test:unit` → `proxy.spec.ts` cobre reauth-clear + bounce preservado; `robots.spec.ts`
  verde; `clear-session.spec.ts` removido.
- Manual: visitar `/login?reauth=1` com cookie de sessão → permanece em `/login` e o cookie é
  removido (DevTools → Application → Cookies); rota protegida depois redireciona p/ `/login`.

### D8 — snapshot do modal (SC-004)

- `bun run diagnose:lighthouse` gera `.lighthouse/settings-modal.html` + `settings-modal.json`
  e **não** imprime "Skipped settings-modal snapshot".

## Fase final (antes do PR)

```bash
bun run lint
bun run test:unit
bun run test:integration
bun run test:e2e
bun run build
```

## Re-baseline

Após o merge das 4 sessões, criar um novo `docs/diagnostics/<YYYY-MM>-baseline.md` (datado,
nunca sobrescrever o de 2026-06) comparando os deltas. Para esta sessão, confirmar apenas:
SEO = 100; react-doctor sem o erro de GET; snapshot do modal presente; sem regressão dos
demais scores (SC-005).
