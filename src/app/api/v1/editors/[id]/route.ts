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
import { updateEditorSchema } from "@/lib/domain/editor";
import {
  EditorEmailAlreadyInUseError,
  EditorNameAlreadyInUseError,
  EditorNotFoundError,
} from "@/lib/errors/editor-errors";
import { createEditorService } from "@/lib/factories/editor";
import type { EditorService } from "@/lib/services/editor-service";

interface EditorByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => EditorService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): EditorByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createEditorService,
    headersFn: headers,
  };
}

export async function handleEditorsUpdate(
  request: Request,
  deps: EditorByIdDeps,
  params: { id: string },
): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const body: unknown = await request.json();
  const parsed = updateEditorSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const editor = await service.update(params.id, parsed.data);
    return NextResponse.json({ data: editor }, { headers: NO_STORE_HEADERS });
  } catch (error: unknown) {
    if (error instanceof EditorNotFoundError) {
      return notFoundResponse("EDITOR_NOT_FOUND", "Editor não encontrado");
    }
    if (error instanceof EditorNameAlreadyInUseError) {
      return conflictResponse("NAME_ALREADY_IN_USE", "Nome já cadastrado");
    }
    if (error instanceof EditorEmailAlreadyInUseError) {
      return conflictResponse("EMAIL_ALREADY_IN_USE", "E-mail já cadastrado");
    }
    throw error;
  }
}

export async function handleEditorsDelete(
  deps: EditorByIdDeps,
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
    if (error instanceof EditorNotFoundError) {
      return notFoundResponse("EDITOR_NOT_FOUND", "Editor não encontrado");
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return handleEditorsUpdate(request, defaultDeps(), params);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const params = await context.params;
  return handleEditorsDelete(defaultDeps(), params);
}
