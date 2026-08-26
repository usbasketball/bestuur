import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client();

export function authEnabled() {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET
  );
}

const REQUIRED_ROLE_ID = "rol_c3jdArQjGALiG1Gq";

/**
 * Auth0 stores roles as a custom claim on the user. The claim key depends on
 * the Auth0 tenant configuration — it may be namespaced
 * (`https://your-domain.auth0.com/roles`) or plain (`roles`).
 */
function getUserRoleIds(user: Record<string, unknown>): string[] {
  const ns = process.env.AUTH0_DOMAIN;
  const namespaced = ns ? user[`https://${ns}/roles`] : undefined;
  if (Array.isArray(namespaced)) return namespaced as string[];

  const plain = user.roles;
  if (Array.isArray(plain)) return plain as string[];

  return [];
}

export function hasRequiredRole(
  user: Record<string, unknown> | undefined
): boolean {
  if (!user) return false;
  return getUserRoleIds(user).includes(REQUIRED_ROLE_ID);
}
