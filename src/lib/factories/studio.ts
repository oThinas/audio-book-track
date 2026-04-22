import { db } from "@/lib/db";
import { DrizzleStudioRepository } from "@/lib/repositories/drizzle/drizzle-studio-repository";
import { StudioService } from "@/lib/services/studio-service";

export function createStudioService(): StudioService {
  const repository = new DrizzleStudioRepository(db);
  return new StudioService(repository);
}
