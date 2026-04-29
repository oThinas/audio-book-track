import type { BookStatus } from "./book";

interface ChapterStatusOnly {
  readonly status: BookStatus;
}

export function computeBookStatus(chapters: ReadonlyArray<ChapterStatusOnly>): BookStatus {
  if (chapters.length === 0) {
    throw new Error("computeBookStatus: invariante violada — livro sem capítulos.");
  }
  if (chapters.every((c) => c.status === "paid")) {
    return "paid";
  }
  if (
    chapters.every((c) => c.status === "completed" || c.status === "paid") &&
    chapters.some((c) => c.status === "completed")
  ) {
    return "completed";
  }
  if (chapters.some((c) => c.status === "reviewing" || c.status === "retake")) {
    return "reviewing";
  }
  if (chapters.some((c) => c.status === "editing")) {
    return "editing";
  }
  return "pending";
}
