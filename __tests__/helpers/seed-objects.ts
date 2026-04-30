/**
 * Sync, side-effect-free seed builders that return plain domain objects for
 * unit tests. No DB, no repository, no async — call inline and use the result
 * directly as a function argument.
 *
 * Companion to `seed.ts` (async scenario seeder that plants data into InMemory
 * repositories). Same goal — centralize test data — different shape.
 *
 * Each builder takes a `Partial<T>` of overrides so call sites only specify
 * the fields that matter for the test.
 */

import type { Studio } from "@/lib/domain/studio";
import type { StudioListItem } from "@/lib/repositories/studio-repository";

export function buildStudio(overrides: Partial<Studio> = {}): Studio {
  return {
    id: "s-1",
    name: "Studio One",
    defaultHourlyRateCents: 8000,
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

export function buildStudioListItem(overrides: Partial<StudioListItem> = {}): StudioListItem {
  return { ...buildStudio(), booksCount: 0, ...overrides };
}
