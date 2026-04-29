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

export class BookPaidPriceLockedError extends Error {
  constructor(bookId: string) {
    super(`Livro ${bookId} possui capítulo pago — valor/hora não pode ser alterado.`);
    this.name = "BookPaidPriceLockedError";
  }
}

export class BookPaidStudioLockedError extends Error {
  constructor(bookId: string) {
    super(`Livro ${bookId} possui capítulo pago — estúdio não pode ser alterado.`);
    this.name = "BookPaidStudioLockedError";
  }
}

export class BookCannotReduceChaptersError extends Error {
  constructor(currentTotal: number, requested: number) {
    super(
      `Não é possível reduzir capítulos: total atual ${currentTotal}, solicitado ${requested}.`,
    );
    this.name = "BookCannotReduceChaptersError";
  }
}
