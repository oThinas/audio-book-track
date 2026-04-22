import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { unauthorizedResponse } from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
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

export async function GET(): Promise<NextResponse> {
  return handleStudiosList(defaultDeps());
}
