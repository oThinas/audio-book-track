import type { UpdateUserPreference, UserPreference } from "@/lib/domain/user-preference";
import { DEFAULT_USER_PREFERENCE } from "@/lib/domain/user-preference";
import type { UserPreferenceRepository } from "@/lib/domain/user-preference-repository";

export class UserPreferenceService {
  constructor(private readonly repository: UserPreferenceRepository) {}

  async getOrDefault(userId: string): Promise<UserPreference> {
    const preference = await this.repository.findByUserId(userId);
    return preference ?? { ...DEFAULT_USER_PREFERENCE };
  }

  async updatePreference(userId: string, data: UpdateUserPreference): Promise<UserPreference> {
    return this.repository.upsert(userId, data);
  }
}
