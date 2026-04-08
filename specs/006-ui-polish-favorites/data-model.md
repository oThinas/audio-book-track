# Data Model: UI Polish, Sidebar Colapsável e Preferências do Usuário

**Date**: 2026-04-01 | **Branch**: `006-ui-polish-favorites`

## New Entity: user_preference

Armazena preferências de personalização do usuário. Relação 1:1 com `user`.

### Schema

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| id | text | PK | generated | Identificador único |
| user_id | text | FK → user(id), UNIQUE, NOT NULL, ON DELETE CASCADE | — | Proprietário da preferência |
| theme | text | NOT NULL, CHECK IN ('light', 'dark', 'system') | 'system' | Tema visual |
| font_size | text | NOT NULL, CHECK IN ('small', 'medium', 'large') | 'medium' | Escala de fonte |
| primary_color | text | NOT NULL, CHECK IN ('blue', 'orange', 'green', 'red', 'amber') | 'blue' | Paleta de cor primária |
| favorite_page | text | NOT NULL, CHECK IN ('dashboard', 'books', 'studios', 'editors', 'narrators', 'settings') | 'dashboard' | Rota de redirecionamento favorita |
| created_at | timestamptz | NOT NULL | now() | Data de criação |
| updated_at | timestamptz | NOT NULL | now(), auto-update | Última atualização |

### Indexes

| Name | Columns | Type | Notes |
|------|---------|------|-------|
| user_preference_user_id_idx | user_id | UNIQUE | FK index (Constitution XI) + garante 1:1 |

### Relationships

```
user (1) ←→ (0..1) user_preference
```

- CASCADE delete: quando o usuário é removido, a preferência é removida.
- Se a preferência não existir, valores padrão são usados (criação lazy no primeiro PATCH).

### Validation Rules (Zod)

```
theme: z.enum(['light', 'dark', 'system'])
fontSize: z.enum(['small', 'medium', 'large'])
primaryColor: z.enum(['blue', 'orange', 'green', 'red', 'amber'])
favoritePage: z.enum(['dashboard', 'books', 'studios', 'editors', 'narrators', 'settings'])
```

Cada campo é opcional no PATCH (partial update). Pelo menos um campo deve estar presente.

### State Transitions

Não há state machine — todos os campos são editáveis a qualquer momento enquanto o usuário estiver autenticado.

### Default Values Strategy

Quando um usuário não tem registro em `user_preference`:
- O sistema usa os defaults definidos na coluna (`system`, `medium`, `blue`, `dashboard`).
- O registro é criado automaticamente no primeiro PATCH (upsert).

## Non-Persisted State: Sidebar Collapse

| Storage | Key | Type | Default | Scope |
|---------|-----|------|---------|-------|
| Cookie | `sidebar-collapsed` | `'true'` \| `'false'` | `'false'` | Por dispositivo/sessão |

- Não é persistido no banco — preferência de sessão local.
- Acessível no Server Component via `cookies()` para evitar layout flash.

## Mapeamento de Rotas (favorite_page → URL → Label PT)

| favorite_page (enum EN) | URL | Label (PT-BR) |
|--------------------------|-----|---------------|
| dashboard | /dashboard | Dashboard |
| books | /books | Livros |
| studios | /studios | Estúdios |
| editors | /editors | Editores |
| narrators | /narrators | Gravadores |
| settings | /settings | Configurações |

Os valores do enum são em inglês (padrão do código). Labels em PT-BR são usados na UI (sidebar, seletores). O mapeamento está em `src/lib/domain/navigable-pages.ts`.

Se a rota não existir no sistema, fallback para `/dashboard`.