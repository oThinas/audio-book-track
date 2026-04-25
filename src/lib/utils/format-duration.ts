const SECONDS_PER_HOUR = 3600;

export interface FormatSecondsAsHoursOptions {
  readonly minDigits?: number;
  readonly maxDigits?: number;
  readonly emptyForZero?: boolean;
}

export function formatSecondsAsHours(
  seconds: number,
  options: FormatSecondsAsHoursOptions = {},
): string {
  if (!Number.isFinite(seconds)) {
    throw new Error(`formatSecondsAsHours: seconds deve ser numérico finito, recebido ${seconds}`);
  }
  const { minDigits = 2, maxDigits = 2, emptyForZero = false } = options;
  if (emptyForZero && seconds === 0) return "";
  const hours = seconds / SECONDS_PER_HOUR;
  return hours.toLocaleString("pt-BR", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
}

export function parseHoursInputToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const normalized = trimmed.replace(",", ".");
  const hours = Number(normalized);
  if (!Number.isFinite(hours) || hours < 0) return null;
  return Math.round(hours * SECONDS_PER_HOUR);
}
