import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "./narrator";

export interface NarratorRepository {
  findAll(): Promise<Narrator[]>;
  findById(id: string): Promise<Narrator | null>;
  findByName(name: string): Promise<Narrator | null>;
  create(input: CreateNarratorInput): Promise<Narrator>;
  update(id: string, input: UpdateNarratorInput): Promise<Narrator>;
  delete(id: string): Promise<void>;
}
