import { NextResponse } from "next/server";
import { auth0, hasRequiredRole } from "@/lib/auth";

export async function requireBestuur(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  if (!session || !hasRequiredRole(session.user as Record<string, unknown>)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}