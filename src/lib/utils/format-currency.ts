export const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCentsBRL(cents: number): string {
  if (!Number.isFinite(cents)) {
    throw new Error(`formatCentsBRL: cents deve ser numérico finito, recebido ${cents}`);
  }
  return BRL_FORMATTER.format(cents / 100);
}
