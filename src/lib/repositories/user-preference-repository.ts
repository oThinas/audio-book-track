import type { UpdateUserPreference, UserPreference } from "@/lib/domain/user-preference";

export interface UserPreferenceRepository {
  findByUserId(userId: string): Promise<UserPreference | null>;
  upsert(userId: string, data: UpdateUserPreference): Promise<UserPreference>;
}
