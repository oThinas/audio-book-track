import type { UpdateUserPreference, UserPreference } from "@/lib/domain/user-preference";
import { DEFAULT_USER_PREFERENCE } from "@/lib/domain/user-preference";
import type { UserPreferenceRepository } from "@/lib/repositories/user-preference-repository";

export class InMemoryUserPreferenceRepository implements UserPreferenceRepository {
  private readonly store = new Map<string, UserPreference>();

  async findByUserId(userId: string): Promise<UserPreference | null> {
    return this.store.get(userId) ?? null;
  }

  async upsert(userId: string, data: UpdateUserPreference): Promise<UserPreference> {
    const existing = this.store.get(userId) ?? { ...DEFAULT_USER_PREFERENCE };
    const updated: UserPreference = { ...existing, ...data };
    this.store.set(userId, updated);
    return updated;
  }

  clear(): void {
    this.store.clear();
  }
}
