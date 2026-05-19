import type { BucketRange } from "./dashboard-bucketing";

export interface BucketAmount {
  readonly startIso: string;
  readonly cents: number;
}

export interface DensifiedBucket {
  readonly startIso: string;
  readonly endIso: string;
  readonly cents: number;
}

export function densifyBuckets(
  buckets: ReadonlyArray<BucketRange>,
  sparse: ReadonlyArray<BucketAmount>,
): DensifiedBucket[] {
  const lookup = new Map(sparse.map((entry) => [entry.startIso, entry.cents]));
  return buckets.map((bucket) => ({
    startIso: bucket.startIso,
    endIso: bucket.endIso,
    cents: lookup.get(bucket.startIso) ?? 0,
  }));
}

export function ticketMedioCents(totalCents: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round(totalCents / count);
}
