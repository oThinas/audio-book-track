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
