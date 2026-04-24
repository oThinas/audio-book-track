import type { RepositoryTx } from "./book-repository";

export interface UnitOfWork {
  transaction<T>(callback: (tx: RepositoryTx) => Promise<T>): Promise<T>;
}
