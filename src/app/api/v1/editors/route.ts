import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { unauthorizedResponse } from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { createEditorService } from "@/lib/factories/editor";
import type { EditorService } from "@/lib/services/editor-service";

interface EditorsDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => EditorService;
  readonly headersFn: () => Promise<Headers>;
}

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

function defaultDeps(): EditorsDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createEditorService,
    headersFn: headers,
  };
}

export async function handleEditorsList(deps: EditorsDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  const data = await service.list();

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function GET(): Promise<NextResponse> {
  return handleEditorsList(defaultDeps());
}
