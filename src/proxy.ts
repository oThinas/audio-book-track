import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Public routes bypass the session-cookie redirect:
// - /login: the login page itself
// - /api/auth: better-auth endpoints (handle their own auth)
// - /api/health: pinged by the external uptime monitor (no cookie)
// - /api/cron: authenticated by Authorization: Bearer <CRON_SECRET>, not by cookie
const PUBLIC_ROUTES = ["/login", "/api/auth", "/api/health", "/api/cron"];

// Every better-auth session cookie that may linger after the server-side
// session is gone. Covers the dev names, the production __Secure- prefixed
// variants (useSecureCookies defaults on), and the cookieCache session_data
// cookie (session.cookieCache.enabled is true).
const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "better-auth.session_data",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Optimistic cookie check for UX redirects only.
// Each protected page/layout must validate the session server-side.
export function proxy(request: NextRequest): NextResponse {
  const sessionCookie = getSessionCookie(request);
  const { pathname, searchParams } = request.nextUrl;

  // Orphan session cleanup: the authenticated layout redirects here when the
  // server-side session is invalid but a stale cookie may linger. Clear every
  // better-auth session cookie and render /login. Evaluated before the
  // "cookie + /login → /dashboard" bounce so a stale cookie does not redirect
  // back into the app. Replaces the deleted GET /api/auth/clear-session route
  // handler (no side effects in a GET handler).
  if (pathname === "/login" && searchParams.has("reauth")) {
    const response = NextResponse.next();
    for (const name of SESSION_COOKIE_NAMES) {
      response.cookies.delete({ name, path: "/" });
    }
    return response;
  }

  // Authenticated user on /login → redirect to /dashboard
  if (sessionCookie && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Unauthenticated user on protected route → redirect to /login
  if (!sessionCookie && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
