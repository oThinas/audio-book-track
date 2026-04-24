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
import { createEditorSchema } from "@/lib/domain/editor";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
} from "@/lib/errors/editor-errors";
import { createEditorService } from "@/lib/factories/editor";
import type { EditorService } from "@/lib/services/editor-service";

interface EditorsDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => EditorService;
  readonly headersFn: () => Promise<Headers>;
}

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

export async function handleEditorsCreate(
  request: Request,
  deps: EditorsDeps,
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = createEditorSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const { editor, reactivated } = await service.create(parsed.data);
    return NextResponse.json(
      { data: editor, meta: { reactivated } },
      {
        status: reactivated ? 200 : 201,
        headers: {
          ...NO_STORE_HEADERS,
          Location: `/api/v1/editors/${editor.id}`,
        },
      },
    );
  } catch (error: unknown) {
    if (error instanceof EditorNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    if (error instanceof EditorEmailAlreadyInUseError) {
      return conflictResponse("EMAIL_ALREADY_IN_USE", "E-mail já cadastrado");
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return handleEditorsList(defaultDeps());
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleEditorsCreate(request, defaultDeps());
}
