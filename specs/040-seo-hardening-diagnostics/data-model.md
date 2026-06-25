# Data Model: Hardening, SEO & tooling (D6 + D7 + D8)

**N/A — esta feature não introduz nem altera entidades de domínio.**

Nenhuma mudança de schema, tabela, coluna, índice, repository ou service. As mudanças são:

- **D6:** borda HTTP (deletar route handler; ajustar middleware `proxy.ts` e o `redirect()` do
  layout). Sem persistência. A limpeza de cookie órfã não apaga sessão no banco (a sessão já é
  inválida/ausente — daí o cookie ser "órfão"); o logout interativo continua deletando a
  sessão no DB via better-auth `signOut` (`databaseHooks.session.delete` registra
  `AUTH_LOGOUT`, inalterado).
- **D7:** rota de metadados estática (`robots.ts`). Sem persistência.
- **D8:** script de diagnóstico. Sem persistência.

### Cookies envolvidos (não são entidades de domínio — referência operacional)

| Cookie | Origem | Tratamento nesta feature |
|---|---|---|
| `better-auth.session_token` (+ `__Secure-`) | better-auth | apagado no middleware na rota `/login?reauth=1` |
| `better-auth.session_data` (+ `__Secure-`) | better-auth (cookieCache) | apagado no middleware na rota `/login?reauth=1` |
