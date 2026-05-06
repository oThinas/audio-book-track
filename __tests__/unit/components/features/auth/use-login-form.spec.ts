// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { jsonResponse } from "@tests/helpers/fetch-response";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLoginForm } from "@/components/features/auth/hooks/use-login-form";
import { authClient } from "@/lib/auth/client";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
  },
}));

function renderLoginHook() {
  return renderHook(() => useLoginForm());
}

describe("useLoginForm", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let signInMock: ReturnType<typeof vi.fn>;
  let routerPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    signInMock = vi.mocked(authClient.signIn.username);
    routerPush = vi.mocked(useRouter()).push as ReturnType<typeof vi.fn>;
  });

  it("starts with showPassword=false and togglePassword flips it", () => {
    const { result } = renderLoginHook();

    expect(result.current.showPassword).toBe(false);

    act(() => {
      result.current.togglePassword();
    });
    expect(result.current.showPassword).toBe(true);

    act(() => {
      result.current.togglePassword();
    });
    expect(result.current.showPassword).toBe(false);
  });

  it("on successful login, fetches preferences and redirects to mapped favoritePage", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { favoritePage: "books" } }));

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(signInMock).toHaveBeenCalledWith({ username: "alice", password: "secret123" });
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/user-preferences");
    expect(routerPush).toHaveBeenCalledWith("/books");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("falls back to /dashboard when preferences fetch returns non-ok", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: { message: "boom" } }));

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(routerPush).toHaveBeenCalledWith("/dashboard");
  });

  it("falls back to /dashboard when preferences fetch throws", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    fetchMock.mockRejectedValueOnce(new Error("network"));

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(routerPush).toHaveBeenCalledWith("/dashboard");
  });

  it("falls back to /dashboard when favoritePage is unknown", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { favoritePage: "unknown-route" } }));

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(routerPush).toHaveBeenCalledWith("/dashboard");
  });

  it("on invalid credentials, fires toast.error and does not redirect", async () => {
    signInMock.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid credentials", code: "INVALID_CREDENTIALS", status: 401 },
    });

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "wrong" });
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Credenciais inválidas. Verifique seu username e senha.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("never calls toast.success in any branch", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { favoritePage: "dashboard" } }));

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
