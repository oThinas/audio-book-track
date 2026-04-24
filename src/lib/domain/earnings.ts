const SECONDS_PER_HOUR = 3600;

export function computeEarningsCents(editedSeconds: number, pricePerHourCents: number): number {
  if (!Number.isInteger(editedSeconds) || editedSeconds < 0) {
    throw new Error(`editedSeconds must be a non-negative integer, received ${editedSeconds}`);
  }
  if (!Number.isInteger(pricePerHourCents) || pricePerHourCents < 0) {
    throw new Error(
      `pricePerHourCents must be a non-negative integer, received ${pricePerHourCents}`,
    );
  }
  return Math.round((editedSeconds * pricePerHourCents) / SECONDS_PER_HOUR);
}

export function sumEarningsCents(
  rows: ReadonlyArray<{ readonly editedSeconds: number; readonly pricePerHourCents: number }>,
): number {
  return rows.reduce(
    (total, row) => total + computeEarningsCents(row.editedSeconds, row.pricePerHourCents),
    0,
  );
}
