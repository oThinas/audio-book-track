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
