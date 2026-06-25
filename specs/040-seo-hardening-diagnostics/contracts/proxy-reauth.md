# Contract: middleware de limpeza de sessão órfã (D6)

Substitui o route handler GET `clear-session` (deletado). A limpeza acontece no middleware
`src/proxy.ts`.

## Gatilho

O layout autenticado (`src/app/(authenticated)/layout.tsx`), ao detectar sessão ausente/
inválida (`auth.api.getSession(...) === null`), executa:

```
redirect("/login?reauth=1");
```

## Comportamento do `proxy()`

Avaliado **antes** da regra "cookie + /login → /dashboard":

| Request | Cookie de sessão | Ação |
|---|---|---|
| `/login?reauth=1` | presente ou ausente | `NextResponse.next()` + **apaga** todos os cookies de sessão do better-auth (`session_token`, `session_data`, variantes `__Secure-`, `path: '/'`); renderiza `/login`. |
| `/login` (sem `reauth`) | presente | redireciona p/ `/dashboard` (bounce **preservado**). |
| `/login` (sem `reauth`) | ausente | renderiza `/login` (inalterado). |
| rota protegida | ausente | redireciona p/ `/login` (inalterado). |

## Requisitos do contrato

- A remoção do cookie DEVE usar `path: '/'` explícito (senão o `Set-Cookie` não casa o cookie
  `path=/` do better-auth) — FR-002.
- DEVE cobrir a variante `__Secure-` (produção/HTTPS) — quebra o loop também em prod — FR-002.
- NÃO DEVE haver efeito colateral em nenhum **GET handler** (`route.ts`) — FR-001/004.
- O logout interativo (`authClient.signOut()`) permanece inalterado — FR-003.

## Verificação

- Unit (`proxy.spec.ts`): os 4 casos da tabela acima.
- E2E: `page.goto("/login?reauth=1")` termina em `/login`; rota protegida pós-logout
  redireciona p/ `/login` — SC-003.
- `react-doctor --verbose`: zero "Side effect in GET handler" — SC-002.
