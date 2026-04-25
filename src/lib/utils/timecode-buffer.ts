const BUFFER_SIZE = 6;

export const TIMECODE_BUFFER_SIZE = BUFFER_SIZE;

export function digitsFromSeconds(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // h above 99 overflows the 2-digit hours slot — we keep the last two digits
  // so the buffer length stays at 6. Callers needing larger ranges should
  // clamp via max before formatting.
  const hh = String(h).padStart(2, "0").slice(-2);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${hh}${mm}${ss}`;
}

export function secondsFromDigits(digits: string): number {
  const padded = digits.padStart(BUFFER_SIZE, "0").slice(-BUFFER_SIZE);
  const hh = Number(padded.slice(0, 2));
  const mm = Number(padded.slice(2, 4));
  const ss = Number(padded.slice(4, 6));
  return hh * 3600 + mm * 60 + ss;
}

export function displayFromDigits(digits: string): string {
  const padded = digits.padStart(BUFFER_SIZE, "0").slice(-BUFFER_SIZE);
  return `${padded.slice(0, 2)}:${padded.slice(2, 4)}:${padded.slice(4, 6)}`;
}
