import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createEditorSchema } from "@/lib/domain/editor";
import { createEditorService } from "@/lib/factories/editor";
import type { EditorService } from "@/lib/services/editor-service";

export interface EditorsRouteDeps {
  readonly createService: () => EditorService;
}

const defaultRouteDeps: EditorsRouteDeps = { createService: createEditorService };

export async function handleEditorsList(
  _request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: EditorsRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const data = await routeDeps.createService().list();
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleEditorsCreate(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: EditorsRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const body: unknown = await request.json();
  const parsed = createEditorSchema.parse(body);
  const { editor, reactivated } = await routeDeps.createService().create(parsed);
  return NextResponse.json(
    { data: editor, meta: { reactivated } },
    {
      status: reactivated ? 200 : 201,
      headers: { ...NO_STORE_HEADERS, Location: `/api/v1/editors/${editor.id}` },
    },
  );
}

export const GET = withApiErrorHandler(handleEditorsList);
export const POST = withApiErrorHandler(handleEditorsCreate);
