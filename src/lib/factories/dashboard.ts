import { db } from "@/lib/db";
import { DrizzleDashboardRepository } from "@/lib/repositories/drizzle/drizzle-dashboard-repository";
import { DashboardService } from "@/lib/services/dashboard-service";

export function createDashboardService(): DashboardService {
  return new DashboardService(new DrizzleDashboardRepository(db));
}
