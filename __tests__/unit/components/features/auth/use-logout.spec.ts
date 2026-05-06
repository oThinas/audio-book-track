// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLogout } from "@/components/features/auth/hooks/use-logout";
import { authClient } from "@/lib/auth/client";

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: { username: vi.fn() },
    signOut: vi.fn(),
  },
}));

describe("useLogout", () => {
  let signOutMock: ReturnType<typeof vi.fn>;
  let routerPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock = vi.mocked(authClient.signOut);
    routerPush = vi.mocked(useRouter()).push as ReturnType<typeof vi.fn>;
  });

  it("starts with isLoading=false", () => {
    const { result } = renderHook(() => useLogout());
    expect(result.current.isLoading).toBe(false);
  });

  it("handleLogout invokes signOut and redirects to /login on success", async () => {
    signOutMock.mockImplementation(
      async ({ fetchOptions }: { fetchOptions: { onSuccess: () => void } }) => {
        fetchOptions.onSuccess();
      },
    );

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when signOut does not invoke onSuccess", async () => {
    signOutMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(routerPush).not.toHaveBeenCalled();
  });

  it("toggles isLoading during the request and resets after completion", async () => {
    let resolveSignOut: (() => void) | null = null;
    signOutMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSignOut = () => resolve();
        }),
    );

    const { result } = renderHook(() => useLogout());

    let logoutPromise!: Promise<void>;
    act(() => {
      logoutPromise = result.current.handleLogout();
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveSignOut?.();
      await logoutPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });
});
