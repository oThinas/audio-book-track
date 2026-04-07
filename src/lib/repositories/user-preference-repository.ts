import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { userPreference } from "@/lib/db/schema";
import type { UpdateUserPreference, UserPreference } from "@/lib/domain/user-preference";
import type { UserPreferenceRepository } from "@/lib/domain/user-preference-repository";

const PREFERENCE_COLUMNS = {
  theme: userPreference.theme,
  fontSize: userPreference.fontSize,
  primaryColor: userPreference.primaryColor,
  favoritePage: userPreference.favoritePage,
} as const;

export class DrizzleUserPreferenceRepository implements UserPreferenceRepository {
  constructor(private readonly db: NodePgDatabase<typeof schema>) {}

  async findByUserId(userId: string): Promise<UserPreference | null> {
    const rows = await this.db
      .select(PREFERENCE_COLUMNS)
      .from(userPreference)
      .where(eq(userPreference.userId, userId));

    return rows[0] ?? null;
  }

  async upsert(userId: string, data: UpdateUserPreference): Promise<UserPreference> {
    const [row] = await this.db
      .insert(userPreference)
      .values({ userId, ...data })
      .onConflictDoUpdate({
        target: userPreference.userId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning(PREFERENCE_COLUMNS);

    return row;
  }
}
