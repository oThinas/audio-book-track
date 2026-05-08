import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { apiFetch as ApiFetchType } from "@/lib/api/api-fetch";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/components/features/auth/navigation-singleton", () => ({
  navigateToLogin: vi.fn(),
}));

const { toast } = await import("sonner");
const { navigateToLogin } = await import("@/components/features/auth/navigation-singleton");

let apiFetch: typeof ApiFetchType;

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function emptyResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers });
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.useRealTimers();
  globalThis.fetch = vi.fn();
  // Re-import apiFetch fresh per test so the 401 debounce state (module-local)
  // doesn't leak across specs.
  vi.resetModules();
  ({ apiFetch } = await import("@/lib/api/api-fetch"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("apiFetch — success outcomes", () => {
  it("200 with JSON → { ok: true, data }", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(200, { data: { id: "abc", name: "Sonora" } }),
    );

    const result = await apiFetch<{ data: { id: string; name: string } }>("/api/v1/studios/abc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({ data: { id: "abc", name: "Sonora" } });
      expect(result.headers).toBeInstanceOf(Headers);
    }
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("201 with JSON → { ok: true, data }", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(201, { data: { id: "new" } }));

    const result = await apiFetch<{ data: { id: string } }>("/api/v1/studios", {
      method: "POST",
      body: { name: "x" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ data: { id: "new" } });
  });

  it("204 → { ok: true, data: null }", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(emptyResponse(204));

    const result = await apiFetch<null>("/api/v1/studios/abc", { method: "DELETE" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
      expect(result.headers).toBeInstanceOf(Headers);
    }
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("serializes body as JSON and sets Content-Type when body provided", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(jsonResponse(200, { data: {} }));

    await apiFetch("/api/v1/studios", { method: "POST", body: { name: "x" } });

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    if (!call) throw new Error("fetch was not called");
    const init = call[1] as RequestInit;
    expect(init.body).toBe(JSON.stringify({ name: "x" }));
    const headers = new Headers(init.headers);
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
  });
});

describe("apiFetch — 401 session-expired", () => {
  it("dispatches warning toast, redirects to /login, returns session-expired", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Sua sessão expirou. Faça login novamente." },
      }),
    );

    const result = await apiFetch("/api/v1/studios");

    expect(result).toEqual({ ok: false, kind: "session-expired" });
    expect(toast.warning).toHaveBeenCalledWith("Sua sessão expirou. Faça login novamente.");
    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it("debounces toast within 1s window across parallel calls", async () => {
    vi.useFakeTimers();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Sua sessão expirou. Faça login novamente." },
      }),
    );

    await Promise.all([apiFetch("/api/v1/studios"), apiFetch("/api/v1/books")]);

    expect(toast.warning).toHaveBeenCalledTimes(1);
    expect(navigateToLogin).toHaveBeenCalledTimes(2);
  });

  it("re-fires toast after debounce window elapses (>1s)", async () => {
    vi.useFakeTimers();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Sua sessão expirou. Faça login novamente." },
      }),
    );

    await apiFetch("/api/v1/studios");
    await vi.advanceTimersByTimeAsync(1100);
    await apiFetch("/api/v1/studios");

    expect(toast.warning).toHaveBeenCalledTimes(2);
  });
});

describe("apiFetch — 422 outcomes", () => {
  it("VALIDATION_ERROR with details[] → field-errors, no toast", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados enviados são inválidos.",
          details: [
            { field: "name", message: "Nome é obrigatório." },
            { field: "email", message: "E-mail inválido." },
          ],
        },
      }),
    );

    const result = await apiFetch("/api/v1/editors", { method: "POST", body: {} });

    expect(result).toEqual({
      ok: false,
      kind: "field-errors",
      fields: { name: "Nome é obrigatório.", email: "E-mail inválido." },
    });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("INVALID_BODY → toast.error + api-error envelope", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(422, {
        error: { code: "INVALID_BODY", message: "Os dados enviados são inválidos." },
      }),
    );

    const result = await apiFetch("/api/v1/books", { method: "POST", body: "garbage" });

    expect(result).toEqual({ ok: false, kind: "api-error", code: "INVALID_BODY" });
    expect(toast.error).toHaveBeenCalledWith("Os dados enviados são inválidos.");
  });
});

describe("apiFetch — domain conflicts (409) and dispatch via catalog variant", () => {
  it("STUDIO_HAS_ACTIVE_BOOKS → toast.warning + details preserved in result", async () => {
    const books = [{ id: "b1", title: "Livro Bloqueante" }];
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: "STUDIO_HAS_ACTIVE_BOOKS",
          message: "Este estúdio possui livros com capítulos ativos.",
          details: { books },
        },
      }),
    );

    const result = await apiFetch("/api/v1/studios/abc", { method: "DELETE" });

    expect(result).toEqual({
      ok: false,
      kind: "api-error",
      code: "STUDIO_HAS_ACTIVE_BOOKS",
      details: { books },
    });
    expect(toast.warning).toHaveBeenCalledWith("Este estúdio possui livros com capítulos ativos.");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("BOOK_NOT_FOUND (404, variant default error) → toast.error + api-error envelope", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(404, {
        error: { code: "BOOK_NOT_FOUND", message: "Livro não encontrado." },
      }),
    );

    const result = await apiFetch("/api/v1/books/x");

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "api-error") {
      expect(result.code).toBe("BOOK_NOT_FOUND");
    }
    expect(toast.error).toHaveBeenCalledWith("Livro não encontrado.");
  });
});

describe("apiFetch — 500 / unparseable / unknown", () => {
  it("INTERNAL_ERROR → toast.error + api-error envelope", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Algo deu errado. Tente novamente em instantes.",
        },
      }),
    );

    const result = await apiFetch("/api/v1/books");

    expect(result).toEqual({ ok: false, kind: "api-error", code: "INTERNAL_ERROR" });
    expect(toast.error).toHaveBeenCalledWith("Algo deu errado. Tente novamente em instantes.");
  });

  it("5xx without parseable JSON → falls back to INTERNAL_ERROR + toast", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("not json", { status: 502, headers: { "content-type": "text/plain" } }),
    );

    const result = await apiFetch("/api/v1/books");

    expect(result).toEqual({ ok: false, kind: "api-error", code: "INTERNAL_ERROR" });
    expect(toast.error).toHaveBeenCalledWith("Algo deu errado. Tente novamente em instantes.");
  });

  it("unknown code → console.warn + toast.error genérico", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(
        418,
        { error: { code: "TOTALLY_UNKNOWN_CODE", message: "Algo bem específico." } },
        { "x-request-id": "req-abc" },
      ),
    );

    const result = await apiFetch("/api/v1/books");

    expect(result.ok).toBe(false);
    if (!result.ok && result.kind === "api-error") {
      expect(result.code).toBe("TOTALLY_UNKNOWN_CODE");
    }
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/apiFetch.*unknown code/),
      expect.objectContaining({ code: "TOTALLY_UNKNOWN_CODE", requestId: "req-abc" }),
    );
    expect(toast.error).toHaveBeenCalledWith("Algo deu errado. Tente novamente em instantes.");
    warnSpy.mockRestore();
  });
});

describe("apiFetch — suppressToastFor escape hatch", () => {
  it("does not toast when code is in suppressToastFor; preserves details in result", async () => {
    const details = { custom: 42 };
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(409, {
        error: {
          code: "STUDIO_HAS_ACTIVE_BOOKS",
          message: "Este estúdio possui livros com capítulos ativos.",
          details,
        },
      }),
    );

    const result = await apiFetch("/api/v1/studios/abc", {
      method: "DELETE",
      suppressToastFor: ["STUDIO_HAS_ACTIVE_BOOKS"],
    });

    expect(result).toEqual({
      ok: false,
      kind: "api-error",
      code: "STUDIO_HAS_ACTIVE_BOOKS",
      details,
    });
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("ignores suppressToastFor for VALIDATION_ERROR (always inline, never toast anyway)", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Os dados enviados são inválidos.",
          details: [{ field: "name", message: "Nome é obrigatório." }],
        },
      }),
    );

    const result = await apiFetch("/api/v1/editors", {
      method: "POST",
      body: {},
      suppressToastFor: ["VALIDATION_ERROR"],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("field-errors");
  });

  it("ignores suppressToastFor for UNAUTHORIZED (session redirect always fires)", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      jsonResponse(401, {
        error: { code: "UNAUTHORIZED", message: "Sua sessão expirou. Faça login novamente." },
      }),
    );

    const result = await apiFetch("/api/v1/x", { suppressToastFor: ["UNAUTHORIZED"] });

    expect(result).toEqual({ ok: false, kind: "session-expired" });
    expect(toast.warning).toHaveBeenCalled();
    expect(navigateToLogin).toHaveBeenCalled();
  });
});

describe("apiFetch — network failures", () => {
  it("rejected fetch → toast.error + network kind", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await apiFetch("/api/v1/books");

    expect(result).toEqual({ ok: false, kind: "network" });
    expect(toast.error).toHaveBeenCalledWith("Verifique sua conexão e tente novamente.");
  });
});
