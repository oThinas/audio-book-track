import type { BlockingBookSummary } from "@/lib/errors/studio-errors";

export class NarratorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "NarratorNameAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Narrador não encontrado: ${id}`);
    this.name = "NarratorNotFoundError";
  }
}

export class NarratorLinkedToActiveChaptersError extends Error {
  constructor(
    id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super(
      `Narrador ${id} está vinculado a capítulos em ${books.length} livro(s) ativo(s) — soft-delete bloqueado.`,
    );
    this.name = "NarratorLinkedToActiveChaptersError";
  }
}
