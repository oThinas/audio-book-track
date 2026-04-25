export class BookNotFoundError extends Error {
  constructor(id: string) {
    super(`Livro não encontrado: ${id}`);
    this.name = "BookNotFoundError";
  }
}

export class BookTitleAlreadyInUseError extends Error {
  constructor(title: string, studioId: string) {
    super(`Título já cadastrado no estúdio ${studioId}: ${title}`);
    this.name = "BookTitleAlreadyInUseError";
  }
}

export class BookStudioNotFoundError extends Error {
  constructor(studioId: string) {
    super(`Estúdio não encontrado ou arquivado: ${studioId}`);
    this.name = "BookStudioNotFoundError";
  }
}

export class BookInlineStudioInvalidError extends Error {
  constructor(studioId: string) {
    super(`Estúdio inline inválido: ${studioId}`);
    this.name = "BookInlineStudioInvalidError";
  }
}
