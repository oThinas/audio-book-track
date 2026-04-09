# Research: Testes de Invalidacao de Sessao

**Date**: 2026-04-09  
**Branch**: `007-session-invalidation-tests`

## R1: Como testar route handlers Next.js com Vitest

**Decision**: Usar `vi.mock` para mockar `next/headers` (cookies) e `next/navigation` (redirect). O mock de `redirect` DEVE lancar erro para replicar o comportamento real.

**Rationale**: `redirect()` do Next.js 16 lanca um erro interno (`NEXT_REDIRECT`) e nunca retorna. O mock deve replicar esse comportamento para que o teste seja fiel ao runtime real. `cookies()` retorna `Promise<ReadonlyRequestCookies>` que pode ser mockado com `mockResolvedValue`.

**Alternatives considered**:
- Testar via HTTP request real (descartado: requer server rodando, seria integration/E2E, nao unit)
- Usar `next/test-utils` (nao existe para route handlers no App Router)

**Pattern**:
```typescript
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string }
    error.digest = `NEXT_REDIRECT;replace;${url};307;`
    throw error
  }),
}))
```

Assertar com `await expect(GET()).rejects.toThrow('NEXT_REDIRECT')`.

## R2: Testes E2E de logout com Playwright

**Decision**: Login via UI, clicar no botao "Sair" na sidebar, verificar redirect para `/login` e impossibilidade de acessar rotas protegidas.

**Rationale**: O botao de logout na sidebar nao tem `data-testid`. O seletor mais confiavel e `getByRole('button', { name: 'Sair' })` ou `getByText('Sair')` dentro do sidebar `[data-testid="sidebar"]`.

**Alternatives considered**:
- Manipular cookies diretamente no browser (descartado: nao testa o fluxo real do usuario)
- Usar API direta de signOut (descartado: nao e E2E)

## R3: Cobertura existente e gaps

**Decision**: Manter testes existentes intactos. Novos testes adicionam cobertura sem duplicar.

**Gaps identificados**:

| Componente | Testes existentes | Gap |
|---|---|---|
| `/api/auth/clear-session` | Nenhum | Unit test completo |
| Proxy (`proxy.ts`) | 5 testes basicos | Rotas aninhadas, `/api/v1/*`, rota exata `/api/auth` |
| Logout E2E | Nenhum | Fluxo completo de logout |
| Logout integration (DB) | 2 testes de delecao | Ja coberto |
| Session persistence | 3 testes | Ja coberto |