import { GraphQLError } from "graphql";
import { NextResponse } from "next/server";
import { auth0, hasRequiredRole } from "@/lib/auth";

export async function requireBestuur(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  if (!session || !hasRequiredRole(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireAuthenticated(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function requireSession(): Promise<NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>> {
  const session = await auth0.getSession();
  if (!session) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  return session as NonNullable<Awaited<ReturnType<typeof auth0.getSession>>>;
}

export async function assertBestuur(): Promise<void> {
  const session = await auth0.getSession();
  if (!session || !hasRequiredRole(session.user as Record<string, unknown>)) {
    throw new GraphQLError("Unauthorized", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
}
