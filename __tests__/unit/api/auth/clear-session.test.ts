import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDelete } = vi.hoisted(() => ({
  mockDelete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ delete: mockDelete }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT") as Error & { digest: string };
    error.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw error;
  }),
}));

import { redirect } from "next/navigation";

import { GET } from "@/app/api/auth/clear-session/route";

describe("GET /api/auth/clear-session (US1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete better-auth.session_token cookie", async () => {
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDelete).toHaveBeenCalledWith("better-auth.session_token");
  });

  it("should redirect to /login", async () => {
    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("should be idempotent when no cookie exists", async () => {
    mockDelete.mockImplementation(() => undefined);

    await expect(GET()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockDelete).toHaveBeenCalledWith("better-auth.session_token");
    expect(redirect).toHaveBeenCalledWith("/login");
  });
});
