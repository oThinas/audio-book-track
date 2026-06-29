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

// All better-auth session cookies cleared by the reauth branch: dev names plus
// the production __Secure- prefixed variants (useSecureCookies defaults on) and
// the cookieCache session_data cookie (cookieCache.enabled is true).
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

describe("Route Protection", () => {
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

  it("should allow authenticated access to nested protected routes", () => {
    mockedGetSessionCookie.mockReturnValue("session-token-value");

    const response = proxy(createRequest("/dashboard/settings"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should NOT redirect unauthenticated API requests (route handler replies 401 JSON)", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/v1/books"));

    // The proxy must let /api/** fall through. A 307 here would be transparently
    // followed by the browser fetch and re-issued against the /login page (→ 405
    // in production), which the client cannot recognize as a session expiry.
    // withApiErrorHandler returns a 401 JSON envelope instead, which the client
    // already handles by redirecting to /login.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should NOT redirect an unauthenticated nested API mutation (/api/v1/chapters/:id)", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/v1/chapters/abc-123"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should allow unauthenticated access to exact /api/auth route", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/api/auth"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("Orphan session cleanup (reauth)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should clear all session cookies and render /login on /login?reauth=1 with a stale cookie", () => {
    mockedGetSessionCookie.mockReturnValue("stale-session-token");

    const response = proxy(createRequest("/login?reauth=1"));

    // Renders /login (no bounce to /dashboard) despite the lingering cookie.
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();

    for (const name of SESSION_COOKIE_NAMES) {
      const cookie = response.cookies.get(name);
      expect(cookie?.value).toBe("");
      expect(cookie?.path).toBe("/");
    }
  });

  it("should render /login on /login?reauth=1 without a cookie (still clears defensively)", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(createRequest("/login?reauth=1"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("should preserve the /login → /dashboard bounce when reauth is absent", () => {
    mockedGetSessionCookie.mockReturnValue("session-token-value");

    const response = proxy(createRequest("/login"));

    expect(response.status).toBe(307);
    const dashboardLocation = response.headers.get("location") ?? "";
    expect(new URL(dashboardLocation).pathname).toBe("/dashboard");
  });
});
