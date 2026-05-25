import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { DomainError } from "@/lib/errors/domain-error";

vi.mock("@/lib/sentry/server", () => ({
  captureServerException: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({ user: { id: "u" }, session: {} })),
    },
  },
}));

import { NextResponse } from "next/server";

import { withApiErrorHandler } from "@/lib/api/with-error-handler";
import { captureServerException } from "@/lib/sentry/server";

const captureServerExceptionMock = vi.mocked(captureServerException);

class TestDomainError extends DomainError {
  constructor() {
    super("test domain error");
    this.code = "BOOK_NOT_FOUND";
  }
  override readonly code = "BOOK_NOT_FOUND";
}

afterEach(() => {
  captureServerExceptionMock.mockClear();
});

describe("withApiErrorHandler — Sentry forwarding", () => {
  it("forwards unexpected Error to captureServerException", async () => {
    const handler = withApiErrorHandler(async () => {
      throw new Error("kaboom");
    });

    await handler(new Request("https://example.com/api/v1/x"), { params: Promise.resolve({}) });

    expect(captureServerExceptionMock).toHaveBeenCalledTimes(1);
    const [error, ctx] = captureServerExceptionMock.mock.calls[0];
    expect((error as Error).message).toBe("kaboom");
    expect(ctx).toEqual(expect.objectContaining({ requestId: expect.any(String) }));
  });

  it("does NOT forward DomainError", async () => {
    const handler = withApiErrorHandler(async () => {
      throw new TestDomainError();
    });

    const response = await handler(new Request("https://example.com/api/v1/y"), {
      params: Promise.resolve({}),
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(captureServerExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT forward ZodError", async () => {
    const handler = withApiErrorHandler(async () => {
      throw new ZodError([
        {
          code: "custom",
          path: ["x"],
          message: "bad",
        },
      ]);
    });

    await handler(new Request("https://example.com/api/v1/z"), { params: Promise.resolve({}) });

    expect(captureServerExceptionMock).not.toHaveBeenCalled();
  });

  it("does NOT forward SyntaxError (bad JSON body)", async () => {
    const handler = withApiErrorHandler(async () => {
      throw new SyntaxError("Unexpected token");
    });

    await handler(new Request("https://example.com/api/v1/w"), { params: Promise.resolve({}) });

    expect(captureServerExceptionMock).not.toHaveBeenCalled();
  });
});

// silence unused NextResponse import (kept for type inference if extended)
void NextResponse;
