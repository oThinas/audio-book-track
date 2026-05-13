/**
 * Feature flags do projeto.
 *
 * Convenção: constantes `as const` que viram código compilado — não há toggle
 * runtime, não há serviço externo, não há flag por usuário. Mudar exige PR +
 * redeploy. Use quando precisar de uma chave de iteração rápida em UX sem
 * comprometer com uma decisão definitiva.
 */
export const featureFlags = {
  /**
   * Exibe a coluna de ganho (R$) nas linhas-resumo de grupos cuja dimensão é
   * "narrador". Como o ganho é pago ao editor, a label "Ganho" pode parecer
   * confusa quando a linha representa um narrador. Default `true` para v1: a
   * coluna aparece com label provisória e iteramos com feedback real antes de
   * decidir entre manter, renomear ou desligar permanentemente.
   *
   * Capítulos individuais (folhas) e linhas-resumo de outras dimensões
   * (editor, status) NÃO são afetados — apenas o `aggregatedCell` quando o
   * nível atual é "narrator".
   */
  SHOW_EARNINGS_IN_NARRATOR_GROUPS: true,
} as const;

export type FeatureFlags = typeof featureFlags;
export type FeatureFlagKey = keyof FeatureFlags;
