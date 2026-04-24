import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import {
  conflictResponse,
  unauthorizedResponse,
  unprocessableEntityResponse,
  validationErrorResponse,
} from "@/lib/api/responses";
import { auth } from "@/lib/auth/server";
import type { Session } from "@/lib/auth/session";
import { BookStudioNotFoundError, BookTitleAlreadyInUseError } from "@/lib/errors/book-errors";
import { createBookService } from "@/lib/factories/book";
import { createBookSchema } from "@/lib/schemas/book";
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

export async function handleBooksCreate(request: Request, deps: BooksDeps): Promise<NextResponse> {
  const session = await deps.getSession({ headers: await deps.headersFn() });
  if (!session) {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessableEntityResponse(
      "VALIDATION_ERROR",
      "Corpo da requisição não é um JSON válido.",
    );
  }

  const parsed = createBookSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error);
  }

  const service = deps.createService();
  try {
    const { book, chapters } = await service.create(parsed.data, session.user.id);
    return NextResponse.json(
      {
        data: {
          id: book.id,
          title: book.title,
          studioId: book.studioId,
          pricePerHourCents: book.pricePerHourCents,
          pdfUrl: book.pdfUrl,
          status: book.status,
          createdAt: book.createdAt,
          updatedAt: book.updatedAt,
          chapters: chapters.map((c) => ({
            id: c.id,
            number: c.number,
            status: c.status,
            narratorId: c.narratorId,
            editorId: c.editorId,
            editedSeconds: c.editedSeconds,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
        },
      },
      {
        status: 201,
        headers: { ...NO_STORE_HEADERS, Location: `/api/v1/books/${book.id}` },
      },
    );
  } catch (error) {
    if (error instanceof BookStudioNotFoundError) {
      return unprocessableEntityResponse("STUDIO_NOT_FOUND", error.message);
    }
    if (error instanceof BookTitleAlreadyInUseError) {
      return conflictResponse("TITLE_ALREADY_IN_USE", error.message);
    }
    throw error;
  }
}

export async function GET(): Promise<NextResponse> {
  return handleBooksList(defaultDeps());
}

export async function POST(request: Request): Promise<NextResponse> {
  return handleBooksCreate(request, defaultDeps());
}
