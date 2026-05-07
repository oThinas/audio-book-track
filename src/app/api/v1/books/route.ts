import { NextResponse } from "next/server";

import { NO_STORE_HEADERS } from "@/lib/api/headers";
import { type AuthenticatedContext, withApiErrorHandler } from "@/lib/api/with-error-handler";
import { createBookService } from "@/lib/factories/book";
import { createBookSchema } from "@/lib/schemas/book";
import type { BookService } from "@/lib/services/book-service";

export interface BooksRouteDeps {
  readonly createService: () => BookService;
}

const defaultRouteDeps: BooksRouteDeps = { createService: createBookService };

export async function handleBooksList(
  _request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: BooksRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const data = await routeDeps.createService().list();
  return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
}

export async function handleBooksCreate(
  request: Request,
  _ctx: AuthenticatedContext<Record<string, never>>,
  routeDeps: BooksRouteDeps = defaultRouteDeps,
): Promise<NextResponse> {
  const body: unknown = await request.json();
  const parsed = createBookSchema.parse(body);
  const { book, chapters } = await routeDeps.createService().create(parsed);
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
}

export const GET = withApiErrorHandler(handleBooksList);
export const POST = withApiErrorHandler(handleBooksCreate);
