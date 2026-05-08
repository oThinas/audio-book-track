// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
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

vi.mock("@/lib/api/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

const { apiFetch } = await import("@/lib/api/api-fetch");

function renderLoginHook() {
  return renderHook(() => useLoginForm());
}

describe("useLoginForm", () => {
  let signInMock: ReturnType<typeof vi.fn>;
  let routerPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
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
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: { data: { favoritePage: "books" } },
      headers: new Headers(),
    });

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(signInMock).toHaveBeenCalledWith({ username: "alice", password: "secret123" });
    expect(apiFetch).toHaveBeenCalledWith("/api/v1/user-preferences");
    expect(routerPush).toHaveBeenCalledWith("/books");
  });

  it("falls back to /dashboard when preferences fetch fails", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: false,
      kind: "api-error",
      code: "INTERNAL_ERROR",
    });

    const { result } = renderLoginHook();

    await act(async () => {
      await result.current.onSubmit({ username: "alice", password: "secret123" });
    });

    expect(routerPush).toHaveBeenCalledWith("/dashboard");
  });

  it("falls back to /dashboard when favoritePage is unknown", async () => {
    signInMock.mockResolvedValueOnce({ data: {}, error: null });
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      data: { data: { favoritePage: "unknown-route" } },
      headers: new Headers(),
    });

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
      "Credenciais inválidas. Verifique seu usuário e senha.",
    );
    expect(apiFetch).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });
});
