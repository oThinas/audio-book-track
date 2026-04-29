export interface BlockingBookSummary {
  readonly id: string;
  readonly title: string;
}

export class StudioNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "StudioNameAlreadyInUseError";
  }
}

export class StudioNotFoundError extends Error {
  constructor(id: string) {
    super(`Estúdio não encontrado: ${id}`);
    this.name = "StudioNotFoundError";
  }
}

export class StudioHasActiveBooksError extends Error {
  constructor(
    id: string,
    readonly books: ReadonlyArray<BlockingBookSummary>,
  ) {
    super(
      `Estúdio ${id} possui ${books.length} livro(s) com capítulos ativos — soft-delete bloqueado.`,
    );
    this.name = "StudioHasActiveBooksError";
  }
}
