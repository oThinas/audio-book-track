import type { UpdateUserPreference, UserPreference } from "./user-preference";

export interface UserPreferenceRepository {
  findByUserId(userId: string): Promise<UserPreference | null>;
  upsert(userId: string, data: UpdateUserPreference): Promise<UserPreference>;
}
