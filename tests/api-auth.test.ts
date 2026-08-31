import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, exportJWK, SignJWT } from "jose";
import {
  verifyBearerToken,
  getAuthContext,
  requireAuthenticated,
  requireSession,
  assertBestuur,
  type GraphQLContext,
} from "../lib/api-auth";
import { auth0 } from "../lib/auth";
import { resolvers } from "../lib/graphql/resolvers";
import { createMockDb, asDb } from "./helpers/mock-orm";
import { db } from "../lib/db";

vi.mock("../lib/auth", () => ({
  auth0: {
    getSession: vi.fn(),
  },
  hasRequiredRole: vi.fn((user: Record<string, unknown> | undefined) => {
    if (!user) return false;
    const roles = user["https://usbasketball.nl/roles"];
    return Array.isArray(roles) && roles.includes("bestuur");
  }),
}));

describe("API Auth & Bearer JWT Verification", () => {
  let keyPair: Awaited<ReturnType<typeof generateKeyPair>>;
  let jwk: Record<string, unknown>;

  beforeAll(async () => {
    keyPair = await generateKeyPair("RS256");
    const exported = await exportJWK(keyPair.publicKey);
    jwk = {
      ...exported,
      kid: "test-key-id",
      alg: "RS256",
      use: "sig",
    };
  });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(auth0.getSession).mockReset();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ keys: [jwk] }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function createValidToken(
    claims: Record<string, unknown> = {},
    expiresIn = "2h",
  ) {
    return new SignJWT({
      sub: "auth0|test-user-123",
      ...claims,
    })
      .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(keyPair.privateKey);
  }

  describe("verifyBearerToken", () => {
    it("returns null for null, undefined, or empty header", async () => {
      expect(await verifyBearerToken(null)).toBeNull();
      expect(await verifyBearerToken(undefined)).toBeNull();
      expect(await verifyBearerToken("")).toBeNull();
    });

    it("returns null for non-Bearer auth schemes", async () => {
      expect(await verifyBearerToken("Basic abc123xyz")).toBeNull();
    });

    it("returns null for empty Bearer token", async () => {
      expect(await verifyBearerToken("Bearer ")).toBeNull();
      expect(await verifyBearerToken("Bearer   ")).toBeNull();
    });

    it("returns payload for valid signed Bearer token", async () => {
      const token = await createValidToken({ email: "user@example.com" });
      const payload = await verifyBearerToken(`Bearer ${token}`);

      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe("auth0|test-user-123");
      expect(payload?.email).toBe("user@example.com");
    });

    it("returns null for invalid/expired token", async () => {
      const expiredToken = await createValidToken({}, "-10s");
      expect(await verifyBearerToken(`Bearer ${expiredToken}`)).toBeNull();
    });

    it("returns null for invalid signature", async () => {
      const otherPair = await generateKeyPair("RS256");
      const invalidToken = await new SignJWT({ sub: "auth0|attacker" })
        .setProtectedHeader({ alg: "RS256", kid: "test-key-id" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .sign(otherPair.privateKey);

      expect(await verifyBearerToken(`Bearer ${invalidToken}`)).toBeNull();
    });
  });

  describe("getAuthContext", () => {
    it("returns empty context when no authorization header is present", async () => {
      const req = new Request("http://localhost:3000/api/graphql");
      const ctx = await getAuthContext(req);

      expect(ctx).toEqual({ tokenSub: null, tokenPayload: null, sub: null });
    });

    it("returns context with sub and payload when valid Bearer token is provided", async () => {
      const token = await createValidToken({ name: "Test User" });
      const req = new Request("http://localhost:3000/api/graphql", {
        headers: { authorization: `Bearer ${token}` },
      });
      const ctx = await getAuthContext(req);

      expect(ctx.sub).toBe("auth0|test-user-123");
      expect(ctx.tokenSub).toBe("auth0|test-user-123");
      expect(ctx.tokenPayload?.name).toBe("Test User");
    });
  });

  describe("requireAuthenticated", () => {
    it("allows request with valid Bearer token without checking session", async () => {
      const token = await createValidToken();
      const req = new Request("http://localhost:3000/api/graphql", {
        headers: { authorization: `Bearer ${token}` },
      });

      const res = await requireAuthenticated(req);
      expect(res).toBeNull();
      expect(auth0.getSession).not.toHaveBeenCalled();
    });

    it("falls back to session cookie when no Bearer header is provided", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce({
        user: { sub: "auth0|cookie-user" },
      } as unknown as Awaited<ReturnType<typeof auth0.getSession>>);

      const req = new Request("http://localhost:3000/api/graphql");
      const res = await requireAuthenticated(req);

      expect(res).toBeNull();
      expect(auth0.getSession).toHaveBeenCalled();
    });

    it("returns 401 when neither valid Bearer token nor session cookie is present", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const req = new Request("http://localhost:3000/api/graphql");
      const res = await requireAuthenticated(req);

      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
      const data = await res?.json();
      expect(data).toEqual({ error: "Unauthorized" });
    });

    it("returns 401 when Bearer token is invalid and no session cookie is present", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const req = new Request("http://localhost:3000/api/graphql", {
        headers: { authorization: "Bearer invalid.token.value" },
      });
      const res = await requireAuthenticated(req);

      expect(res).not.toBeNull();
      expect(res?.status).toBe(401);
    });
  });

  describe("requireSession", () => {
    it("returns session when session cookie exists", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce({
        user: { sub: "auth0|cookie-user", email: "cookie@x.nl" },
      } as unknown as Awaited<ReturnType<typeof auth0.getSession>>);

      const session = await requireSession();
      expect(session.user.sub).toBe("auth0|cookie-user");
    });

    it("returns synthetic session from GraphQLContext when cookie is absent", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const ctx: GraphQLContext = {
        tokenSub: "auth0|token-user",
        sub: "auth0|token-user",
        tokenPayload: { sub: "auth0|token-user", email: "token@x.nl" },
      };

      const session = await requireSession(ctx);
      expect(session.user.sub).toBe("auth0|token-user");
      expect(session.user.email).toBe("token@x.nl");
    });

    it("throws UNAUTHORIZED GraphQLError when neither session nor token context is present", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      await expect(requireSession()).rejects.toThrow("Unauthorized");
    });
  });

  describe("assertBestuur", () => {
    it("succeeds when session has bestuur role", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce({
        user: {
          sub: "auth0|admin",
          "https://usbasketball.nl/roles": ["bestuur"],
        },
      } as unknown as Awaited<ReturnType<typeof auth0.getSession>>);

      await expect(assertBestuur()).resolves.toBeUndefined();
    });

    it("succeeds when token payload in GraphQLContext has bestuur role", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const ctx: GraphQLContext = {
        tokenSub: "auth0|admin-token",
        tokenPayload: {
          sub: "auth0|admin-token",
          "https://usbasketball.nl/roles": ["bestuur"],
        },
      };

      await expect(assertBestuur(ctx)).resolves.toBeUndefined();
    });

    it("throws when neither session nor token has required role", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce({
        user: { sub: "auth0|regular-user", "https://usbasketball.nl/roles": ["member"] },
      } as unknown as Awaited<ReturnType<typeof auth0.getSession>>);

      await expect(assertBestuur()).rejects.toThrow("Unauthorized");
    });
  });

  describe("resolvers.Query.me", () => {
    it("returns user using token context fallback when no session cookie is present", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const mockDb = createMockDb({
        User: [
          {
            id: "user-1",
            email: "tokenuser@x.nl",
            firstName: "Token",
            lastNamePrefix: null,
            lastName: "User",
            nbbNumber: "12345",
            refereeLevel: "BS2",
            foysUserId: "foys-1",
            memberSince: null,
          },
        ],
      });

      // Temporarily swap db
      const originalDbOrm = db.orm;
      Object.assign(db, asDb(mockDb));

      try {
        const queryResolvers = resolvers.Query as Record<
          string,
          (
            _parent: unknown,
            _args: unknown,
            context?: GraphQLContext,
          ) => Promise<unknown>
        >;
        const meResolver = queryResolvers.me;

        const result = await meResolver(
          {},
          {},
          { tokenSub: "auth0|token-user-123", sub: "auth0|token-user-123" },
        );

        expect(result).toEqual({
          id: "user-1",
          email: "tokenuser@x.nl",
          firstName: "Token",
          lastNamePrefix: null,
          lastName: "User",
          nbbNumber: "12345",
          refereeLevel: "BS2",
          foysUserId: "foys-1",
          memberSince: null,
        });
      } finally {
        Object.assign(db, { orm: originalDbOrm });
      }
    });

    it("throws Unauthorized when neither session nor token context is present", async () => {
      vi.mocked(auth0.getSession).mockResolvedValueOnce(null);

      const queryResolvers = resolvers.Query as Record<
        string,
        (
          _parent: unknown,
          _args: unknown,
          context?: GraphQLContext,
        ) => Promise<unknown>
      >;
      const meResolver = queryResolvers.me;

      await expect(meResolver({}, {}, {})).rejects.toThrow("Unauthorized");
    });
  });
});
