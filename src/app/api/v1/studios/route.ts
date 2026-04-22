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
import { createStudioSchema } from "@/lib/domain/studio";
import { StudioNameAlreadyInUseError } from "@/lib/errors/studio-errors";
import { createStudioService } from "@/lib/factories/studio";
import type { StudioService } from "@/lib/services/studio-service";

interface StudiosDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => StudioService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): StudiosDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createStudioService,
    headersFn: headers,
  };
}

export async function handleStudiosList(deps: StudiosDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  const data = await service.list();

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleStudiosCreate(
  request: Request,
  deps: StudiosDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = createStudioSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const studio = await service.create(parsed.data);
    return NextResponse.json(
      { data: studio },
      {
        status: 201,
        headers: {
          ...NO_STORE_HEADERS,
          Location: `/api/v1/studios/${studio.id}`,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof StudioNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return handleStudiosList(defaultDeps());
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleStudiosCreate(request, defaultDeps());
}
