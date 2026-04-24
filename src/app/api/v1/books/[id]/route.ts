import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import {
  notFoundResponse,
  unauthorizedResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { createBookService } from "@/lib/factories/book";
import { bookIdParamsSchema } from "@/lib/schemas/book";
import type { BookService } from "@/lib/services/book-service";

interface BookByIdDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => BookService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): BookByIdDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createBookService,
    headersFn: headers,
  };
}

export async function handleBookDetail(rawId: string, deps: BookByIdDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const parsed = bookIdParamsSchema.safeParse({ id: rawId });
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  const detail = await service.findById(parsed.data.id);
  if (!detail) {
    return notFoundResponse("NOT_FOUND", "Livro não encontrado");
  }

  return NextResponse.json({ data: detail }, { headers: NO_STORE_HEADERS });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  return handleBookDetail(id, defaultDeps());
}
