# API Contract: User Preferences

**Base URL**: `/api/v1/user-preferences`

## PATCH /api/v1/user-preferences

Atualiza uma ou mais preferências do usuário autenticado. Auto-save individual — cada campo pode ser atualizado independentemente.

### Authentication

Requer sessão ativa (cookie `better-auth.session_token`). Retorna `401` se não autenticado.

### Request Body

Partial update — pelo menos um campo deve estar presente.

```json
{
  "theme": "dark",
  "fontSize": "large",
  "primaryColor": "green",
  "favoritePage": "books"
}
```

| Field | Type | Required | Values | Default |
|-------|------|----------|--------|---------|
| theme | string | No | `light`, `dark`, `system` | `system` |
| fontSize | string | No | `small`, `medium`, `large` | `medium` |
| primaryColor | string | No | `blue`, `orange`, `green`, `red`, `amber` | `blue` |
| favoritePage | string | No | `dashboard`, `books`, `studios`, `editors`, `narrators`, `settings` | `dashboard` |

### Responses

**200 OK** — Preferência atualizada (ou criada via upsert).

```json
{
  "data": {
    "theme": "dark",
    "fontSize": "large",
    "primaryColor": "green",
    "favoritePage": "books"
  }
}
```

**401 Unauthorized** — Sessão inválida ou ausente.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Sessão não encontrada ou expirada."
  }
}
```

**422 Unprocessable Entity** — Dados inválidos (campo com valor não permitido ou body vazio).

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dados inválidos.",
    "details": [
      { "field": "theme", "message": "Valor deve ser 'light', 'dark' ou 'system'." }
    ]
  }
}
```

### Behavior Notes

- **Upsert**: Se o usuário não tem registro de preferência, o primeiro PATCH cria com os defaults + campo(s) informado(s).
- **Idempotência**: PATCH com o mesmo valor retorna 200 sem alteração real no banco.
- **Validação**: Zod schema no controller. Pelo menos um campo deve estar presente no body.

---

## GET /api/v1/user-preferences

Retorna as preferências do usuário autenticado. Usado pelo Server Component do layout para aplicar tema, cor, fonte e rota favorita.

### Authentication

Requer sessão ativa. Retorna `401` se não autenticado.

### Responses

**200 OK** — Preferências encontradas.

```json
{
  "data": {
    "theme": "system",
    "fontSize": "medium",
    "primaryColor": "blue",
    "favoritePage": "dashboard"
  }
}
```

**200 OK** — Sem preferências salvas (retorna defaults).

```json
{
  "data": {
    "theme": "system",
    "fontSize": "medium",
    "primaryColor": "blue",
    "favoritePage": "dashboard"
  }
}
```

**401 Unauthorized** — Sessão inválida.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Sessão não encontrada ou expirada."
  }
}
```

### Behavior Notes

- Se o usuário não tem registro, retorna defaults sem criar o registro (lazy creation apenas no PATCH).
- Usado internamente pelo Server Component para SSR — não precisa de debounce.