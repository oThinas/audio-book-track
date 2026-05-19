import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "@/lib/db/schema";
import { DrizzleDashboardRepository } from "@/lib/repositories/drizzle/drizzle-dashboard-repository";
import { DashboardService } from "@/lib/services/dashboard-service";

export function createDashboardService(db: NodePgDatabase<typeof schema>): DashboardService {
  return new DashboardService(new DrizzleDashboardRepository(db));
}
