import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { auth0, authEnabled, hasRequiredRole } from "@/lib/auth";

const handleI18nRouting = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  if (!authEnabled()) {
    if (request.nextUrl.pathname.startsWith("/auth")) {
      return new NextResponse("Authentication is not configured.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return handleI18nRouting(request);
  }

  const authResponse = await auth0.middleware(request);

  // Allow Auth0 callback/login/logout routes through
  if (request.nextUrl.pathname.startsWith("/auth")) {
    return authResponse;
  }

  // Allow the unauthorized page through without role check
  if (request.nextUrl.pathname.endsWith("/unauthorized")) {
    const response = handleI18nRouting(request);
    for (const [key, value] of authResponse.headers) {
      response.headers.append(key, value);
    }
    return response;
  }

  // Check if user is logged in and has the required role
  const session = await auth0.getSession(request);
  console.log("[auth] Session exists:", !!session);
  if (session) {
    const user = session.user as Record<string, unknown>;
    console.log("[auth] User sub:", user?.sub);
    console.log("[auth] User email:", user?.email);
  }

  if (session && !hasRequiredRole(session.user as Record<string, unknown>)) {
    console.log("[auth] Redirecting to unauthorized");
    const locale =
      request.nextUrl.pathname.match(/^\/(en|nl)/)?.[1] ??
      routing.defaultLocale;
    return NextResponse.redirect(new URL(`/${locale}/unauthorized`, request.url));
  }
  console.log("[auth] Role check passed, allowing request");

  const response = handleI18nRouting(request);

  for (const [key, value] of authResponse.headers) {
    if (key.toLowerCase() === "x-middleware-next" && response.status >= 300) {
      continue;
    }
    response.headers.append(key, value);
  }

  return response;
}

export const config = {
  matcher: "/((?!api|trpc|sentry-tunnel|_next|_vercel|.*\\..*).*)",
};
