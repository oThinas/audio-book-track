const SECONDS_PER_HOUR = 3600;

export function formatSecondsAsHours(seconds: number, fractionDigits = 2): string {
  if (!Number.isFinite(seconds)) {
    throw new Error(`formatSecondsAsHours: seconds deve ser numérico finito, recebido ${seconds}`);
  }
  const hours = seconds / SECONDS_PER_HOUR;
  return hours.toLocaleString("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
