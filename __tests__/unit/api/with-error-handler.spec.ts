import { NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import type { Session } from "@/lib/auth/session";
import { BookNotFoundError } from "@/lib/errors/book-errors";
import { StudioHasActiveBooksError } from "@/lib/errors/studio-errors";
import type { ServerLogger } from "@/lib/logger/server-logger";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

const LEAK_PATTERNS = [
  /\bat \//,
  /sql:/i,
  /select\s+\*\s+from/i,
  /postgres:\/\//i,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
];

interface Fakes {
  readonly logger: {
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  readonly getSession: ReturnType<typeof vi.fn>;
  readonly headersFn: ReturnType<typeof vi.fn>;
}

function createFakes(
  overrides: Partial<{ session: Session | null; incomingRequestId: string | null }> = {},
): Fakes {
  const session = overrides.session !== undefined ? overrides.session : { user: { id: "user-1" } };
  const incoming = overrides.incomingRequestId === undefined ? null : overrides.incomingRequestId;
  const headers = new Headers();
  if (incoming !== null) headers.set("X-Request-Id", incoming);
  return {
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    } satisfies ServerLogger as unknown as Fakes["logger"],
    getSession: vi.fn().mockResolvedValue(session),
    headersFn: vi.fn().mockResolvedValue(headers),
  };
}

function plainContext(): { params: Promise<Record<string, never>> } {
  return { params: Promise.resolve({}) };
}

async function readJson(response: NextResponse): Promise<{ body: string; parsed: unknown }> {
  const body = await response.text();
  return { body, parsed: body.length > 0 ? JSON.parse(body) : null };
}

describe("withApiErrorHandler", () => {
  it("success: returns 2xx and echoes a generated X-Request-Id when no incoming header", async () => {
    const fakes = createFakes();
    const handler = withApiErrorHandler(
      async () => NextResponse.json({ data: { ok: true } }, { status: 200 }),
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());

    expect(response.status).toBe(200);
    const reqId = response.headers.get("X-Request-Id");
    expect(reqId).toMatch(UUID_V4);
  });

  it("success: echoes the incoming X-Request-Id when valid", async () => {
    const fakes = createFakes({ incomingRequestId: VALID_REQUEST_ID });
    const handler = withApiErrorHandler(
      async () => NextResponse.json({ data: {} }, { status: 200 }),
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());

    expect(response.headers.get("X-Request-Id")).toBe(VALID_REQUEST_ID);
  });

  it("401 UNAUTHORIZED when requireAuth (default true) and session is null", async () => {
    const fakes = createFakes({ session: null });
    const handler = withApiErrorHandler(
      async () => NextResponse.json({ data: {} }, { status: 200 }),
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed } = await readJson(response);

    expect(response.status).toBe(401);
    expect(parsed).toMatchObject({
      error: { code: "UNAUTHORIZED", message: "Sua sessão expirou. Faça login novamente." },
    });
    expect(response.headers.get("X-Request-Id")).toMatch(UUID_V4);
  });

  it("requireAuth: false skips session check and runs the handler", async () => {
    const fakes = createFakes({ session: null });
    const handler = withApiErrorHandler(
      async () => NextResponse.json({ data: { healthy: true } }, { status: 200 }),
      { requireAuth: false },
      fakes,
    );

    const response = await handler(new Request("http://test.local/health"), plainContext());

    expect(response.status).toBe(200);
    expect(fakes.getSession).not.toHaveBeenCalled();
  });

  it("422 VALIDATION_ERROR when handler throws ZodError, with normalized details[]", async () => {
    const fakes = createFakes();
    const schema = z.object({ name: z.string().min(1, "Nome é obrigatório.") });
    const handler = withApiErrorHandler(
      async () => {
        schema.parse({ name: "" });
        throw new Error("unreachable");
      },
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed } = await readJson(response);

    expect(response.status).toBe(422);
    expect(parsed).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Os dados enviados são inválidos.",
        details: expect.arrayContaining([
          expect.objectContaining({ field: "name", message: "Nome é obrigatório." }),
        ]),
      },
    });
  });

  it("422 INVALID_BODY when handler throws a SyntaxError (malformed JSON)", async () => {
    const fakes = createFakes();
    const handler = withApiErrorHandler(
      async () => {
        throw new SyntaxError("Unexpected token } in JSON at position 5");
      },
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed } = await readJson(response);

    expect(response.status).toBe(422);
    expect(parsed).toMatchObject({ error: { code: "INVALID_BODY" } });
  });

  it("DomainError hit: maps BookNotFoundError to 404 BOOK_NOT_FOUND with PT-BR message", async () => {
    const fakes = createFakes();
    const handler = withApiErrorHandler(
      async () => {
        throw new BookNotFoundError("11111111-1111-4111-8111-111111111111");
      },
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed, body } = await readJson(response);

    expect(response.status).toBe(404);
    expect(parsed).toMatchObject({
      error: { code: "BOOK_NOT_FOUND", message: "Livro não encontrado." },
    });
    for (const pattern of LEAK_PATTERNS) {
      expect(body, `body leaked pattern ${pattern}`).not.toMatch(pattern);
    }
  });

  it("getDetails(): includes structured details for StudioHasActiveBooksError", async () => {
    const fakes = createFakes();
    const blocking = [{ id: "book-1", title: "Livro Bloqueante" }];
    const handler = withApiErrorHandler(
      async () => {
        throw new StudioHasActiveBooksError("studio-id", blocking);
      },
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed } = await readJson(response);

    expect(response.status).toBe(409);
    expect(parsed).toMatchObject({
      error: {
        code: "STUDIO_HAS_ACTIVE_BOOKS",
        details: { books: blocking },
      },
    });
  });

  it("500 INTERNAL_ERROR fallback: hides original message, logs stack with requestId, no leaks in body", async () => {
    const fakes = createFakes({ incomingRequestId: VALID_REQUEST_ID });
    const leakyError = new Error(
      "internal: select * from users; postgres://user:pw@host/db at /home/app/db.ts:42",
    );
    const handler = withApiErrorHandler(
      async () => {
        throw leakyError;
      },
      {},
      fakes,
    );

    const response = await handler(new Request("http://test.local/x"), plainContext());
    const { parsed, body } = await readJson(response);

    expect(response.status).toBe(500);
    expect(parsed).toMatchObject({
      error: { code: "INTERNAL_ERROR", message: "Algo deu errado. Tente novamente em instantes." },
    });
    for (const pattern of LEAK_PATTERNS) {
      expect(body, `body leaked pattern ${pattern}`).not.toMatch(pattern);
    }

    expect(fakes.logger.error).toHaveBeenCalledTimes(1);
    const [, ctx] = fakes.logger.error.mock.calls[0];
    expect(ctx).toMatchObject({ requestId: VALID_REQUEST_ID });
    expect(ctx.error).toBeInstanceOf(Error);
    expect((ctx.error as Error).message).toBe(leakyError.message);
  });

  it("X-Request-Id is present on all error responses", async () => {
    const fakes = createFakes({ session: null });
    const handler401 = withApiErrorHandler(async () => NextResponse.json({}), {}, fakes);
    const r401 = await handler401(new Request("http://test.local/x"), plainContext());
    expect(r401.headers.get("X-Request-Id")).toMatch(UUID_V4);

    const fakes2 = createFakes();
    const handler500 = withApiErrorHandler(
      async () => {
        throw new Error("boom");
      },
      {},
      fakes2,
    );
    const r500 = await handler500(new Request("http://test.local/x"), plainContext());
    expect(r500.headers.get("X-Request-Id")).toMatch(UUID_V4);
  });
});
