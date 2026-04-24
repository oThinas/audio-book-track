import type { CreateStudioInput, Studio, UpdateStudioInput } from "@/lib/domain/studio";

export interface StudioRepository {
  findAll(): Promise<Studio[]>;
  findById(id: string): Promise<Studio | null>;
  findByName(name: string): Promise<Studio | null>;
  create(input: CreateStudioInput): Promise<Studio>;
  update(id: string, input: UpdateStudioInput): Promise<Studio>;
  delete(id: string): Promise<void>;
}
