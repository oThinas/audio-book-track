import { headers } from "next/headers";
import { NextResponse } from "next/server";

import {
  conflictResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { createNarratorSchema } from "@/lib/domain/narrator";
import { NarratorEmailAlreadyInUseError } from "@/lib/errors/narrator-errors";
import { createNarratorService } from "@/lib/factories/narrator";
import type { NarratorService } from "@/lib/services/narrator-service";

interface NarratorsDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => NarratorService;
  readonly headersFn: () => Promise<Headers>;
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

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
    const narrator = await service.create(parsed.data);
    return NextResponse.json(
      { data: narrator },
      {
        status: 201,
        headers: {
          ...NO_STORE_HEADERS,
          Location: `/api/v1/narrators/${narrator.id}`,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof NarratorEmailAlreadyInUseError) {
      return conflictResponse("EMAIL_ALREADY_IN_USE", "E-mail já cadastrado");
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
