import { db } from "@/lib/db";
import { DrizzleUserPreferenceRepository } from "@/lib/repositories/user-preference-repository";
import { UserPreferenceService } from "@/lib/services/user-preference-service";

export function createUserPreferenceService(): UserPreferenceService {
  const repository = new DrizzleUserPreferenceRepository(db);
  return new UserPreferenceService(repository);
}
