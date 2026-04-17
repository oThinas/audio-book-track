import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { unauthorizedResponse } from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import { createNarratorService } from "@/lib/factories/narrator";
import type { NarratorService } from "@/lib/services/narrator-service";

interface Session {
  readonly user: { readonly id: string };
}

interface NarratorsListDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => NarratorService;
  readonly headersFn: () => Promise<Headers>;
}

export async function handleNarratorsList(deps: NarratorsListDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  const data = await service.list();

  return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(): Promise<NextResponse> {
  return handleNarratorsList({
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createNarratorService,
    headersFn: headers,
  });
}
