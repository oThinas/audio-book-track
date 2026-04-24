export class ChapterNotFoundError extends Error {
  constructor(id: string) {
    super(`Capítulo não encontrado: ${id}`);
    this.name = "ChapterNotFoundError";
  }
}

export class ChapterNumberAlreadyInUseError extends Error {
  constructor(bookId: string, number: number) {
    super(`Número ${number} já existe no livro ${bookId}`);
    this.name = "ChapterNumberAlreadyInUseError";
  }
}
