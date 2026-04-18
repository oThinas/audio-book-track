import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  conflictResponse,
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { updateNarratorSchema } from "@/lib/domain/narrator";
import { NarratorNameAlreadyInUseError, NarratorNotFoundError } from "@/lib/errors/narrator-errors";
import { createNarratorService } from "@/lib/factories/narrator";
import type { NarratorService } from "@/lib/services/narrator-service";

interface NarratorByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => NarratorService;
  readonly headersFn: () => Promise<Headers>;
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function defaultDeps(): NarratorByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createNarratorService,
    headersFn: headers,
  };
}

export async function handleNarratorsUpdate(
  request: Request,
  deps: NarratorByIdDeps,
  params: { id: string },
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = updateNarratorSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const narrator = await service.update(params.id, parsed.data);
    return NextResponse.json({ data: narrator }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof NarratorNotFoundError) {
      return notFoundResponse("NARRATOR_NOT_FOUND", "Narrador não encontrado");
    }
    if (error instanceof NarratorNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    throw error;
  }
}

export async function handleNarratorsDelete(
  deps: NarratorByIdDeps,
  params: { id: string },
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  try {
    await service.delete(params.id);
    return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof NarratorNotFoundError) {
      return notFoundResponse("NARRATOR_NOT_FOUND", "Narrador não encontrado");
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return handleNarratorsUpdate(request, defaultDeps(), params);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return handleNarratorsDelete(defaultDeps(), params);
}
