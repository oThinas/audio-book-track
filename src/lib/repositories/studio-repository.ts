import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";

import type { RepositoryTx } from "./book-repository";

export interface ReactivateStudioOverrides {
  readonly defaultHourlyRateCents?: number;
}

export interface StudioListItem extends Studio {
  readonly booksCount: number;
}

export interface StudioRepository {
  findAll(): Promise<Studio[]>;
  findAllWithCounts(): Promise<StudioListItem[]>;
  findById(id: string): Promise<Studio | null>;
  findByIdIncludingDeleted(id: string): Promise<Studio | null>;
  findByName(name: string): Promise<Studio | null>;
  findByNameIncludingDeleted(name: string): Promise<Studio | null>;
  create(input: CreateStudioInput, tx?: RepositoryTx): Promise<Studio>;
  update(id: string, input: UpdateStudioInput, tx?: RepositoryTx): Promise<Studio>;
  softDelete(id: string, tx?: RepositoryTx): Promise<void>;
  reactivate(id: string, overrides?: ReactivateStudioOverrides, tx?: RepositoryTx): Promise<Studio>;
  delete(id: string, tx?: RepositoryTx): Promise<void>;
}
