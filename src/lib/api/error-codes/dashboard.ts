import type { ErrorCatalogEntry } from "./types";

export const dashboardCodes = {
  DASHBOARD_INVALID_PERIOD: {
    status: 422,
    message: "Período inválido. Verifique as datas selecionadas.",
  },
  DASHBOARD_WIDGETS_INVALID_KEY: {
    status: 422,
    message: "Uma das chaves de widget enviadas é inválida.",
  },
} satisfies Readonly<Record<string, ErrorCatalogEntry>>;
