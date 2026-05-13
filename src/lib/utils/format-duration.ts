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
    throw new Error(`formatSecondsAsHours: seconds must be a finite number, received ${seconds}`);
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

const SECONDS_PER_MINUTE = 60;

export function formatSecondsAsHHMMSS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(
      `formatSecondsAsHHMMSS: seconds must be a non-negative integer, received ${seconds}`,
    );
  }
  const total = Math.floor(seconds);
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = total % SECONDS_PER_MINUTE;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formato compacto para soma de duração em linhas-resumo de grupos (FR-005).
 *
 * Casos:
 * - 0s → "0min"
 * - apenas minutos → "Ymin" (ex: "23min")
 * - múltiplo exato de hora → "Xh" (ex: "3h")
 * - misto → "Xh Ymin" (ex: "1h 24min")
 *
 * Segundos parciais são truncados (não arredondados).
 */
export function formatGroupedSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(
      `formatGroupedSeconds: seconds must be a non-negative finite number, received ${seconds}`,
    );
  }
  const total = Math.floor(seconds);
  if (total === 0) return "0min";
  const hours = Math.floor(total / SECONDS_PER_HOUR);
  const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}
