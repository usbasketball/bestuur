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
 * (`https://usbasketball.nl/roles`) or plain (`roles`).
 */
function getUserRoleIds(user: Record<string, unknown>): string[] {
  const ns = process.env.AUTH0_NAMESPACE ?? `https://${process.env.AUTH0_DOMAIN}`;
  const nsKey = `${ns}/roles`;
  const namespaced = user[nsKey];

  console.log("[auth] AUTH0_NAMESPACE:", ns);
  console.log("[auth] Looking up namespaced claim key:", nsKey);
  console.log("[auth] Namespaced claim value:", namespaced);
  console.log("[auth] User keys:", Object.keys(user));

  if (Array.isArray(namespaced)) {
    console.log("[auth] Found roles via namespaced claim:", namespaced);
    return namespaced as string[];
  }

  const plain = user.roles;
  console.log("[auth] Plain roles claim value:", plain);

  if (Array.isArray(plain)) {
    console.log("[auth] Found roles via plain claim:", plain);
    return plain as string[];
  }

  console.log("[auth] No roles found on user object");
  return [];
}

export function hasRequiredRole(
  user: Record<string, unknown> | undefined
): boolean {
  if (!user) {
    console.log("[auth] hasRequiredRole: no user provided");
    return false;
  }
  const roles = getUserRoleIds(user);
  const hasRole = roles.includes(REQUIRED_ROLE_ID);
  console.log("[auth] Required role:", REQUIRED_ROLE_ID);
  console.log("[auth] Has required role:", hasRole);
  return hasRole;
}
