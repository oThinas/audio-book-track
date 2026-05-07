import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createNarratorSchema } from "@/lib/domain/narrator";
import { createNarratorService } from "@/lib/factories/narrator";
import type { NarratorService } from "@/lib/services/narrator-service";

export interface NarratorsRouteDeps {
  readonly createService: () => NarratorService;
}

const defaultRouteDeps: NarratorsRouteDeps = { createService: createNarratorService };

export async function handleNarratorsList(
  _request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: NarratorsRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const data = await routeDeps.createService().list();
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleNarratorsCreate(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: NarratorsRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const body: unknown = await request.json();
  const parsed = createNarratorSchema.parse(body);
  const { narrator, reactivated } = await routeDeps.createService().create(parsed);
  return NextResponse.json(
    { data: narrator, meta: { reactivated } },
    {
      status: reactivated ? 200 : 201,
      headers: { ...NO_STORE_HEADERS, Location: `/api/v1/narrators/${narrator.id}` },
    },
  );
}

export const GET = withApiErrorHandler(handleNarratorsList);
export const POST = withApiErrorHandler(handleNarratorsCreate);
