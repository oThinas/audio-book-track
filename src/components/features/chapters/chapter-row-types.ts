import type { ChapterStatus } from "@/lib/domain/chapter";

export interface ChapterRowEntity {
  readonly id: string;
  readonly title: string;
  readonly position: number;
  readonly status: ChapterStatus;
  readonly narrator: { readonly id: string; readonly name: string } | null;
  readonly editor: { readonly id: string; readonly name: string } | null;
  readonly editedSeconds: number;
  readonly deadline: string | null;
}

export interface ChapterRowOption {
  readonly id: string;
  readonly name: string;
}
