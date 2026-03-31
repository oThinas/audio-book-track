import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api/auth"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

// Optimistic cookie check for UX redirects only.
// Each protected page/layout must validate the session server-side.
export function middleware(request: NextRequest): NextResponse {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;

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
