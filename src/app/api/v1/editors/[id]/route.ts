import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { updateEditorSchema } from "@/lib/domain/editor";
import { createEditorService, createEditorSoftDeleteDeps } from "@/lib/factories/editor";
import type { EditorService, SoftDeleteEditorDeps } from "@/lib/services/editor-service";

export interface EditorByIdRouteDeps {
  readonly createService: () => EditorService;
  readonly createSoftDeleteDeps: () => SoftDeleteEditorDeps;
}

const defaultRouteDeps: EditorByIdRouteDeps = {
  createService: createEditorService,
  createSoftDeleteDeps: createEditorSoftDeleteDeps,
};

export async function handleEditorsUpdate(
  request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: EditorByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const body: unknown = await request.json();
  const parsed = updateEditorSchema.parse(body);
  const editor = await routeDeps.createService().update(id, parsed);
  return NextResponse.json({ data: editor }, { headers: NO_STORE_HEADERS });
}

export async function handleEditorsDelete(
  _request: Request,
  ctx: AuthenticatedContext<{ id: string }>,
  routeDeps: EditorByIdRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const { id } = await ctx.params;
  await routeDeps.createService().softDelete(id, routeDeps.createSoftDeleteDeps());
  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}

export const PATCH = withApiErrorHandler<{ id: string }>(handleEditorsUpdate);
export const DELETE = withApiErrorHandler<{ id: string }>(handleEditorsDelete);
