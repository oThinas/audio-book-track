import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { unauthorizedResponse } from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { createBookService } from "@/lib/factories/book";
import type { BookService } from "@/lib/services/book-service";

interface BooksDeps {
  readonly getSession: (args: { headers: Headers }) => Promise<Session | null>;
  readonly createService: () => BookService;
  readonly headersFn: () => Promise<Headers>;
}

function defaultDeps(): BooksDeps {
  return {
    getSession: (args) => auth.api.getSession(args) as Promise<Session | null>,
    createService: createBookService,
    headersFn: headers,
  };
}

export async function handleBooksList(deps: BooksDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  const service = deps.createService();
  const data = await service.listForUser(session.user.id);

  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function GET(): Promise<NextResponse> {
  return handleBooksList(defaultDeps());
}
