import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createStudioRequestSchema } from "@/lib/domain/studio";
import { createStudioService } from "@/lib/factories/studio";
import type { StudioService } from "@/lib/services/studio-service";

export interface StudiosRouteDeps {
  readonly createService: () => StudioService;
}

const defaultRouteDeps: StudiosRouteDeps = { createService: createStudioService };

export async function handleStudiosList(
  _request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: StudiosRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const data = await routeDeps.createService().list();
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleStudiosCreate(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: StudiosRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const body: unknown = await request.json();
  const parsed = createStudioRequestSchema.parse(body);
  const { inline, ...input } = parsed;
  const { studio, reactivated, rateResetForInline } = await routeDeps
    .createService()
    .create(input, inline ? { inline: true } : {});

  return NextResponse.json(
    {
      data: studio,
      meta: { reactivated, ...(rateResetForInline ? { rateResetForInline: true } : {}) },
    },
    {
      status: reactivated ? 200 : 201,
      headers: { ...NO_STORE_HEADERS, Location: `/api/v1/studios/${studio.id}` },
    },
  );
}

export const GET = withApiErrorHandler(handleStudiosList);
export const POST = withApiErrorHandler(handleStudiosCreate);
