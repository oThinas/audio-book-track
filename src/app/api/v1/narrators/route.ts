import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import {
  conflictResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { createNarratorSchema } from "@/lib/domain/narrator";
import { NarratorNameAlreadyInUseError } from "@/lib/errors/narrator-errors";
import { createNarratorService } from "@/lib/factories/narrator";
import type { NarratorService } from "@/lib/services/narrator-service";

interface NarratorsDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => NarratorService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): NarratorsDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createNarratorService,
    headersFn: headers,
  };
}

export async function handleNarratorsList(deps: NarratorsDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  const data = await service.list();

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleNarratorsCreate(
  request: Request,
  deps: NarratorsDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = createNarratorSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const { narrator, reactivated } = await service.create(parsed.data);
    return NextResponse.json(
      { data: narrator, meta: { reactivated } },
      {
        status: reactivated ? 200 : 201,
        headers: {
          ...NO_STORE_HEADERS,
          Location: `/api/v1/narrators/${narrator.id}`,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof NarratorNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return handleNarratorsList(defaultDeps());
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleNarratorsCreate(request, defaultDeps());
}
