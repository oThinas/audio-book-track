import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: vi.fn(),
}));

import { getSessionCookie } from "better-auth/cookies";

import { proxy } from "@/proxy";

const mockedGetSessionCookie = vi.mocked(getSessionCookie);

function createRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:1197"));
}

describe("Route Protection (US2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should redirect unauthenticated user from /dashboard to /login", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/dashboard"));

    expect(response.status).toBe(307);
    const loginLocation = response.headers.get("location") ?? "";
    expect(new URL(loginLocation).pathname).toBe("/login");
  });

  it("should allow authenticated user to access /dashboard", () => {
    mockedGetSessionCookie.mockReturnValue("session-token-value");

    const response = proxy(createRequest("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should redirect authenticated user from /login to /dashboard", () => {
    mockedGetSessionCookie.mockReturnValue("session-token-value");

    const response = proxy(createRequest("/login"));

    expect(response.status).toBe(307);
    const dashboardLocation = response.headers.get("location") ?? "";
    expect(new URL(dashboardLocation).pathname).toBe("/dashboard");
  });

  it("should allow unauthenticated user to access /login", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/login"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should not block /api/auth/* routes for unauthenticated users", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/auth/get-session"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should redirect unauthenticated user from nested protected route (/dashboard/settings)", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/dashboard/settings"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
  });

  it("should allow unauthenticated access to /api/auth/clear-session", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/auth/clear-session"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should allow authenticated access to nested protected routes", () => {
    mockedGetSessionCookie.mockReturnValue("session-token-value");

    const response = proxy(createRequest("/dashboard/settings"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should redirect unauthenticated user from protected API route (/api/v1/books)", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/v1/books"));

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(new URL(location).pathname).toBe("/login");
  });

  it("should allow unauthenticated access to exact /api/auth route", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/auth"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});
