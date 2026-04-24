import type { CreateNarratorInput, Narrator, UpdateNarratorInput } from "@/lib/domain/narrator";
import type { NarratorRepository } from "@/lib/repositories/narrator-repository";

export class NarratorService {
  constructor(private readonly repository: NarratorRepository) {}

  async list(): Promise<Narrator[]> {
    return this.repository.findAll();
  }

  async create(input: CreateNarratorInput): Promise<Narrator> {
    return this.repository.create(input);
  }

  async update(id: string, input: UpdateNarratorInput): Promise<Narrator> {
    return this.repository.update(id, input);
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
