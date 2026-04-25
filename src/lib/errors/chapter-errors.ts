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

export class ChapterPaidLockedError extends Error {
  constructor(id: string) {
    super(
      `Capítulo ${id} está em status 'paid' — narrador, editor e horas editadas não podem ser alterados.`,
    );
    this.name = "ChapterPaidLockedError";
  }
}

export class ChapterInvalidTransitionError extends Error {
  constructor(
    readonly from: string,
    readonly to: string,
  ) {
    super(`Transição inválida de '${from}' para '${to}'.`);
    this.name = "ChapterInvalidTransitionError";
  }
}

export class ChapterNarratorRequiredError extends Error {
  constructor() {
    super("Narrador é obrigatório para iniciar edição.");
    this.name = "ChapterNarratorRequiredError";
  }
}

export class ChapterEditorOrSecondsRequiredError extends Error {
  constructor() {
    super("Editor e horas editadas (> 0) são obrigatórios para enviar para revisão.");
    this.name = "ChapterEditorOrSecondsRequiredError";
  }
}

export class ChapterReversionConfirmationRequiredError extends Error {
  constructor() {
    super("Reversão de 'paid' para 'completed' exige confirmação explícita.");
    this.name = "ChapterReversionConfirmationRequiredError";
  }
}
