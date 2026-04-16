export class NarratorEmailAlreadyInUseError extends Error {
  constructor(email: string) {
    super(`E-mail já cadastrado: ${email}`);
    this.name = "NarratorEmailAlreadyInUseError";
  }
}

export class NarratorNotFoundError extends Error {
  constructor(id: string) {
    super(`Narrador não encontrado: ${id}`);
    this.name = "NarratorNotFoundError";
  }
}
