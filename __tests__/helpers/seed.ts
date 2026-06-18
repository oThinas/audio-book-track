/**
 * Sync, side-effect-free seed builders that return plain domain objects for
 * unit tests. No DB, no repository, no async — call inline and use the result
 * directly as a function argument.
 *
 * Companion to `seed-in-memory.ts` (async scenario seeder that plants data
 * into InMemory repositories). Same goal — centralize test data —
 * different shape.
 *
 * Each builder takes a `Partial<T>` of overrides so call sites only specify
 * the fields that matter for the test.
 */

import type { BookSummaryRow } from "@/components/features/books/books-table";
import type { ChapterRowData } from "@/components/features/chapters/chapters-table";
import type { Editor } from "@/lib/domain/editor";
import type { Narrator } from "@/lib/domain/narrator";
import type { Studio } from "@/lib/domain/studio";
import type { EditorListItem } from "@/lib/repositories/editor-repository";
import type { NarratorListItem } from "@/lib/repositories/narrator-repository";
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

export function buildNarrator(overrides: Partial<Narrator> = {}): Narrator {
  return {
    id: "n-1",
    name: "Narrator One",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

export function buildNarratorListItem(overrides: Partial<NarratorListItem> = {}): NarratorListItem {
  return { ...buildNarrator(), chaptersCount: 0, ...overrides };
}

export function buildEditor(overrides: Partial<Editor> = {}): Editor {
  return {
    id: "e-1",
    name: "Editor One",
    email: "editor.one@studio.com",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

export function buildEditorListItem(overrides: Partial<EditorListItem> = {}): EditorListItem {
  return { ...buildEditor(), chaptersCount: 0, ...overrides };
}

export function buildBookSummaryRow(overrides: Partial<BookSummaryRow> = {}): BookSummaryRow {
  return {
    id: "b-1",
    title: "Book One",
    studio: { id: "s-1", name: "Studio One" },
    pricePerHourCents: 8000,
    status: "pending",
    totalChapters: 1,
    completedChapters: 0,
    totalEarningsCents: 0,
    focusThisWeekCount: 0,
    ...overrides,
  };
}

export function buildChapterRowData(overrides: Partial<ChapterRowData> = {}): ChapterRowData {
  return {
    id: "c-1",
    title: "Capítulo 1",
    position: 0,
    status: "pending",
    narrator: null,
    editor: null,
    editedSeconds: 0,
    deadline: null,
    ...overrides,
  };
}
