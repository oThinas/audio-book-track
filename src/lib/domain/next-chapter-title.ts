const NUMBERED_RE = /^Capítulo (\d+)$/;

export function nextChapterTitle(existingTitles: readonly string[]): string {
  let max = 0;
  for (const t of existingTitles) {
    const m = NUMBERED_RE.exec(t);
    if (m) {
      const n = Number(m[1]);
      if (Number.isInteger(n) && n > max) {
        max = n;
      }
    }
  }
  return `Capítulo ${max + 1}`;
}
