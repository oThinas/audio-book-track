# Contract: User Preference — Dashboard Widgets

Extensão do contrato existente de `PATCH /api/v1/user-preferences` (ou endpoint equivalente em uso) para aceitar o novo campo `dashboardWidgets`.

## Request shape (UpdateUserPreference)

```typescript
import { z } from "zod";
import { dashboardWidgetSchema } from "@/lib/domain/dashboard-widget";

export const updateUserPreferenceSchema = z
  .object({
    theme: themeSchema.optional(),
    fontSize: fontSizeSchema.optional(),
    primaryColor: primaryColorSchema.optional(),
    favoritePage: favoritePageSchema.optional(),
    // NEW:
    dashboardWidgets: z
      .array(dashboardWidgetSchema)
      .max(9)
      .transform((arr) => Array.from(new Set(arr)))
      .optional(),
  })
  .refine(
    (data) =>
      data.theme !== undefined ||
      data.fontSize !== undefined ||
      data.primaryColor !== undefined ||
      data.favoritePage !== undefined ||
      data.dashboardWidgets !== undefined,
    { message: "Pelo menos um campo deve ser informado." },
  );
```

## Behavior

- **Array vazio**: válido. Representa "todos os widgets desligados". `/dashboard` renderiza `<WidgetsEmptyState />` (FR-033).
- **Array com chaves desconhecidas**: 422 com `details: [{ field: "dashboardWidgets", message: "Chave de widget inválida: <key>" }]`.
- **Duplicatas**: deduplicadas via `Array.from(new Set(...))` no transform. Resposta retorna lista sem duplicatas.
- **Persistência**: `UPDATE user_preference SET dashboard_widgets = $1, updated_at = now() WHERE user_id = $2 RETURNING *`.
- **Default em criação**: se um usuário ainda não tem linha em `user_preference`, a criação automática inclui o array completo (`DEFAULT_DASHBOARD_WIDGETS`).

## Response shape (sucesso)

```json
{
  "data": {
    "theme": "system",
    "fontSize": "medium",
    "primaryColor": "blue",
    "favoritePage": "dashboard",
    "dashboardWidgets": [
      "a-receber-agora",
      "receita-periodo",
      "funil-status",
      "atrasados",
      "grafico-receita"
    ]
  }
}
```

## Error catalog additions

Em `src/lib/api/error-codes.ts`, adicionar:

```typescript
"dashboard-widgets:invalid-key": {
  status: 422,
  message: "Uma das chaves de widget enviadas é inválida.",
},
```
