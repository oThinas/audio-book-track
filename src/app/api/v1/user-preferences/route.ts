import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import { updateUserPreferenceSchema } from "@/lib/domain/user-preference";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

export async function GET(): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = createUserPreferenceService();
  const data = await service.getOrDefault(session.user.id);

  return NextResponse.json({ data });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = updateUserPreferenceSchema.safeParse(body);

  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = createUserPreferenceService();
  const data = await service.updatePreference(session.user.id, parsed.data);

  return NextResponse.json({ data });
}
