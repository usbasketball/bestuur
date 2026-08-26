import {
  Auth0Client,
  filterDefaultIdTokenClaims,
} from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  async beforeSessionSaved(session, idToken) {
    const ns =
      process.env.AUTH0_NAMESPACE ?? `https://${process.env.AUTH0_DOMAIN}`;
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(session.user),
        [`${ns}/roles`]: (session.user as Record<string, unknown>)[
          `${ns}/roles`
        ],
      },
    };
  },
});

export function authEnabled() {
  return Boolean(
    process.env.AUTH0_DOMAIN &&
      process.env.AUTH0_CLIENT_ID &&
      process.env.AUTH0_CLIENT_SECRET &&
      process.env.AUTH0_SECRET
  );
}

const BESTUUR_ROLE_SLUG = "bestuur";

function getUserRoleSlugs(user: Record<string, unknown>): string[] {
  const ns =
    process.env.AUTH0_NAMESPACE ?? `https://${process.env.AUTH0_DOMAIN}`;
  const roles = user[`${ns}/roles`];
  if (Array.isArray(roles)) return roles as string[];
  return [];
}

export function hasRequiredRole(
  user: Record<string, unknown> | undefined
): boolean {
  if (!user) return false;
  return getUserRoleSlugs(user).includes(BESTUUR_ROLE_SLUG);
}
