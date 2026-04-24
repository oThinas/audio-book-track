export class EditorNameAlreadyInUseError extends Error {
  constructor(name: string) {
    super(`Nome já cadastrado: ${name}`);
    this.name = "EditorNameAlreadyInUseError";
  }
}

export class EditorEmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "EditorEmailAlreadyInUseError";
  }
}

export class EditorNotFoundError extends Error {
  constructor(id: string) {
    super(`Editor não encontrado: ${id}`);
    this.name = "EditorNotFoundError";
  }
}

export class EditorLinkedToActiveChaptersError extends Error {
  constructor(
    id: string,
    readonly activeChaptersCount: number,
  ) {
    super(
      `Editor ${id} está vinculado a ${activeChaptersCount} capítulo(s) ativo(s) — soft-delete bloqueado.`,
    );
    this.name = "EditorLinkedToActiveChaptersError";
  }
}
