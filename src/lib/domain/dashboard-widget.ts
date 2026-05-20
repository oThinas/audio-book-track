import { z } from "zod";

export const DASHBOARD_WIDGETS = [
  "a-receber-agora",
  "receita-periodo",
  "ticket-medio",
  "ranking-estudio",
  "ranking-narrador",
  "ranking-editor",
  "funil-status",
  "atrasados",
  "grafico-receita",
] as const;

export type DashboardWidgetKey = (typeof DASHBOARD_WIDGETS)[number];

export type DashboardWidgetSection = "financial" | "operational" | "retrospective";

export interface DashboardWidgetMeta {
  readonly key: DashboardWidgetKey;
  readonly titlePtBr: string;
  readonly descriptionPtBr: string;
  readonly section: DashboardWidgetSection;
}

export const DASHBOARD_WIDGET_META: Record<DashboardWidgetKey, DashboardWidgetMeta> = {
  "a-receber-agora": {
    key: "a-receber-agora",
    titlePtBr: "A receber agora",
    descriptionPtBr:
      "Soma de receita dos capítulos concluídos ainda não pagos. Snapshot do momento, sem filtro de período.",
    section: "financial",
  },
  "receita-periodo": {
    key: "receita-periodo",
    titlePtBr: "Receita realizada no período",
    descriptionPtBr: "Total recebido em capítulos pagos dentro do período selecionado.",
    section: "financial",
  },
  "ticket-medio": {
    key: "ticket-medio",
    titlePtBr: "Ticket médio por capítulo",
    descriptionPtBr: "Receita do período dividida pelo número de capítulos pagos.",
    section: "financial",
  },
  "ranking-estudio": {
    key: "ranking-estudio",
    titlePtBr: "Ranking de estúdios",
    descriptionPtBr: "Top 10 estúdios por receita no período.",
    section: "financial",
  },
  "ranking-narrador": {
    key: "ranking-narrador",
    titlePtBr: "Ranking de narradores",
    descriptionPtBr: "Top 10 narradores por receita no período.",
    section: "financial",
  },
  "ranking-editor": {
    key: "ranking-editor",
    titlePtBr: "Ranking de editores",
    descriptionPtBr: "Top 10 editores por receita no período.",
    section: "financial",
  },
  "funil-status": {
    key: "funil-status",
    titlePtBr: "Funil de status",
    descriptionPtBr: "Contagem atual de capítulos em cada estado do ciclo de vida.",
    section: "operational",
  },
  atrasados: {
    key: "atrasados",
    titlePtBr: "Capítulos atrasados",
    descriptionPtBr: "Capítulos com prazo vencido em status ativo. Clique para abrir o livro.",
    section: "operational",
  },
  "grafico-receita": {
    key: "grafico-receita",
    titlePtBr: "Receita ao longo do período",
    descriptionPtBr:
      "Série temporal de receita realizada. Granularidade ajusta automaticamente ao período.",
    section: "retrospective",
  },
};

export const DEFAULT_DASHBOARD_WIDGETS: ReadonlyArray<DashboardWidgetKey> = [...DASHBOARD_WIDGETS];

export const dashboardWidgetSchema = z.enum(DASHBOARD_WIDGETS);

export const dashboardWidgetsArraySchema = z
  .array(dashboardWidgetSchema)
  .transform((arr) => Array.from(new Set(arr)));
