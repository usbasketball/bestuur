import { GraphQLError } from "graphql";
import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { auth0, hasRequiredRole } from "@/lib/auth";

const AUTH0_JWKS_URL =
  process.env.AUTH0_JWKS_URL ??
  (process.env.AUTH0_M2M_DOMAIN
    ? `https://${process.env.AUTH0_M2M_DOMAIN}/.well-known/jwks.json`
    : "https://usbasketball.eu.auth0.com/.well-known/jwks.json");

const JWKS = createRemoteJWKSet(new URL(AUTH0_JWKS_URL));

export type GraphQLContext = {
  tokenSub?: string | null;
  tokenPayload?: JWTPayload | null;
  sub?: string | null;
};

export async function verifyBearerToken(
  authHeader: string | null | undefined
): Promise<JWTPayload | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWKS);
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthContext(request: Request): Promise<GraphQLContext> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { tokenSub: null, tokenPayload: null, sub: null };
  }

  const payload = await verifyBearerToken(authHeader);
  const sub = typeof payload?.sub === "string" ? payload.sub : null;
  return {
    tokenSub: sub,
    tokenPayload: payload,
    sub,
  };
}

export async function requireBestuur(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  if (!session || !hasRequiredRole(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireAuthenticated(
  request?: Request
): Promise<NextResponse | null> {
  if (request) {
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      const payload = await verifyBearerToken(authHeader);
      if (payload) {
        return null;
      }
    }
  }

  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireSession(
  context?: GraphQLContext
): Promise<{ user: { sub?: string; [key: string]: unknown } }> {
  const session = await auth0.getSession();
  if (session?.user) {
    return session as NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;
  }
  const sub = context?.tokenSub ?? context?.sub;
  if (sub) {
    return {
      user: {
        sub,
        ...(context?.tokenPayload ?? {}),
      },
    };
  }
  throw new GraphQLError("Unauthorized", {
    extensions: { code: "UNAUTHORIZED" },
  });
}

export async function assertBestuur(context?: GraphQLContext): Promise<void> {
  const session = await auth0.getSession();
  if (session && hasRequiredRole(session.user as Record<string, unknown>)) {
    return;
  }
  if (
    context?.tokenPayload &&
    hasRequiredRole(context.tokenPayload as Record<string, unknown>)
  ) {
    return;
  }
  throw new GraphQLError("Unauthorized", {
    extensions: { code: "UNAUTHORIZED" },
  });
}
