import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { updateStudioSchema } from "@/lib/domain/studio";
import { StudioNameAlreadyInUseError, StudioNotFoundError } from "@/lib/errors/studio-errors";
import { createStudioService } from "@/lib/factories/studio";
import type { StudioService } from "@/lib/services/studio-service";

interface StudioByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => StudioService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): StudioByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createStudioService,
    headersFn: headers,
  };
}

export async function handleStudiosUpdate(
  request: Request,
  deps: StudioByIdDeps,
  params: { id: string },
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = updateStudioSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const studio = await service.update(params.id, parsed.data);
    return NextResponse.json({ data: studio }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof StudioNotFoundError) {
      return notFoundResponse("STUDIO_NOT_FOUND", "Estúdio não encontrado");
    }
    if (error instanceof StudioNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return handleStudiosUpdate(request, defaultDeps(), params);
}
