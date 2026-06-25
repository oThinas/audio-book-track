# Contract: robots.txt (D7)

## Recurso

`GET /robots.txt` — gerado por `src/app/robots.ts` (`MetadataRoute.Robots`).

## Saída esperada (texto servido)

```text
User-Agent: *
Allow: /
```

- **Sem** `Disallow:` bloqueante (qualquer `Disallow: /` reprovaria `is-crawlable`).
- **Sem** `Sitemap:` (o app não publica sitemap).

## Requisitos do contrato

- DEVE ser **acessível publicamente**, sem sessão (o matcher do `proxy.ts` já isenta
  `robots.txt`) — FR-007.
- DEVE ser sintaticamente **válido** para o audit `robots-txt` do Lighthouse — FR-006/008.
- NÃO DEVE bloquear as rotas auditadas (`/login`, `/dashboard`, `/books`, `/books/:id`) para
  não reprovar `is-crawlable` — SC-001.

## Verificação

- Unit: `robots()` retorna `{ rules: { userAgent: "*", allow: "/" } }`.
- E2E (sem sessão): `GET /robots.txt` → status 200 e corpo contém `Allow: /` (confirma FR-007
  acessibilidade pública + FR-006 conteúdo).
- Lighthouse: audit `robots-txt` = pass **e** `is-crawlable` = pass → SEO = 100.
