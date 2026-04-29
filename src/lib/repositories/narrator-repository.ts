import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";

import type { RepositoryTx } from "./book-repository";

export interface NarratorListItem extends Narrator {
  readonly chaptersCount: number;
}

export interface NarratorRepository {
  findAll(): Promise<Narrator[]>;
  findAllWithCounts(): Promise<NarratorListItem[]>;
  findById(id: string): Promise<Narrator | null>;
  findByName(name: string): Promise<Narrator | null>;
  findByNameIncludingDeleted(name: string): Promise<Narrator | null>;
  create(input: CreateNarratorInput, tx?: RepositoryTx): Promise<Narrator>;
  update(id: string, input: UpdateNarratorInput, tx?: RepositoryTx): Promise<Narrator>;
  softDelete(id: string, tx?: RepositoryTx): Promise<void>;
  reactivate(id: string, tx?: RepositoryTx): Promise<Narrator>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
}
