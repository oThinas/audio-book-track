import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";
import type { StudioRepository } from "@/lib/domain/studio-repository";

export class StudioService {
  constructor(private readonly repository: StudioRepository) {}

  async list(): Promise<Studio[]> {
    return this.repository.findAll();
  }

  async create(input: CreateStudioInput): Promise<Studio> {
    return this.repository.create({
      name: input.name.trim(),
      defaultHourlyRate: input.defaultHourlyRate,
    });
  }

  async update(id: string, input: UpdateStudioInput): Promise<Studio> {
    return this.repository.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.defaultHourlyRate !== undefined
        ? { defaultHourlyRate: input.defaultHourlyRate }
        : {}),
    });
  }

  async delete(id: string): Promise<void> {
    return this.repository.delete(id);
  }
}
