import type { NextResponse } from "next/server";

import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";

async function handleDebugSentry(
  _request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
): Promise<NextResponse> {
  throw new Error("debug-sentry: intentional production capture check");
}

export const GET = withApiErrorHandler(handleDebugSentry);
