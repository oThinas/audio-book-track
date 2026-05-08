import { NextResponse } from "next/server";

import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import { updateUserPreferenceSchema } from "@/lib/domain/user-preference";
import { createUserPreferenceService } from "@/lib/factories/user-preference";

export const GET = withApiErrorHandler(async (_request, { session }) => {
  const service = createUserPreferenceService();
  const data = await service.getOrDefault(session.user.id);
  return NextResponse.json({ data });
});

export const PATCH = withApiErrorHandler(async (request, { session }) => {
  const body: unknown = await request.json();
  const parsed = updateUserPreferenceSchema.parse(body);
  const service = createUserPreferenceService();
  const data = await service.updatePreference(session.user.id, parsed);
  return NextResponse.json({ data });
});
