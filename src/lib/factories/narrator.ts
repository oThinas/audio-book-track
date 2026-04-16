import { db } from "@/lib/db";
import { DrizzleNarratorRepository } from "@/lib/repositories/drizzle/drizzle-narrator-repository";
import { NarratorService } from "@/lib/services/narrator-service";

export function createNarratorService(): NarratorService {
  const repository = new DrizzleNarratorRepository(db);
  return new NarratorService(repository);
}
