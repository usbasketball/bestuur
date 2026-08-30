import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  splitName,
  upsertUser,
  fetchAllFoysMembers,
  fetchRefereeLevel,
  getToken,
  fetchMemberDetail,
} from "../scripts/sync-users";
import { jsonResponse, errorResponse, mockFetch } from "./helpers/mock-fetch";
import { createMockDb, asDb } from "./helpers/mock-orm";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("splitName", () => {
  const member = (fullName: string | null): Parameters<typeof splitName>[0] => ({
    fullName,
    email: "a@x.nl",
    federationMembershipIdentifier: "100",
    guid: "g-1",
  });

  it("splits a simple two-part name", () => {
    expect(splitName(member("Anna Bakker"))).toEqual({
      firstName: "Anna",
      lastNamePrefix: null,
      lastName: "Bakker",
    });
  });

  it("splits a non-prefix multi-word name into a single last name", () => {
    expect(splitName(member("Anna Bakker de Vries"))).toEqual({
      firstName: "Anna",
      lastNamePrefix: null,
      lastName: "Bakker de Vries",
    });
  });

  it("recognises the 'van der' prefix", () => {
    expect(splitName(member("Jan van der Berg"))).toEqual({
      firstName: "Jan",
      lastNamePrefix: "van der",
      lastName: "Berg",
    });
  });

  it("recognises the 'van den' prefix", () => {
    expect(splitName(member("Piet van den Hoek"))).toEqual({
      firstName: "Piet",
      lastNamePrefix: "van den",
      lastName: "Hoek",
    });
  });

  it("recognises the 'ten' prefix", () => {
    expect(splitName(member("Kees ten Doorn"))).toEqual({
      firstName: "Kees",
      lastNamePrefix: "ten",
      lastName: "Doorn",
    });
  });

  it("handles a single-word full name", () => {
    expect(splitName(member("Bono"))).toEqual({
      firstName: "Bono",
      lastNamePrefix: null,
      lastName: null,
    });
  });

  it("handles empty or whitespace-only names", () => {
    expect(splitName(member(""))).toEqual({ firstName: null, lastNamePrefix: null, lastName: null });
    expect(splitName(member(null))).toEqual({ firstName: null, lastNamePrefix: null, lastName: null });
  });
});

describe("fetchAllFoysMembers", () => {
  it("paginates through all members", async () => {
    const page1 = Array.from({ length: 500 }, (_, i) => ({
      email: `a${i}@x.nl`,
      federationMembershipIdentifier: String(i + 1),
      guid: `g-${i}`,
      fullName: `Lid ${i}`,
    }));
    mockFetch(
      jsonResponse({ totalCount: 501, items: page1 }),
      jsonResponse({ totalCount: 501, items: [{ email: "b@x.nl", federationMembershipIdentifier: "501", guid: "g-501", fullName: "B" }] }),
    );

    const result = await fetchAllFoysMembers();

    expect(result.totalCount).toBe(501);
    expect(result.items).toHaveLength(501);
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    await expect(fetchAllFoysMembers()).rejects.toThrow(/500/);
  });
});

describe("fetchMemberDetail", () => {
  it("returns the parsed detail on success", async () => {
    mockFetch(jsonResponse({ memberSince: "2014-08-17" }));
    expect(await fetchMemberDetail("guid-1")).toEqual({ memberSince: "2014-08-17" });
  });

  it("returns null on non-OK responses", async () => {
    mockFetch(errorResponse(404, "missing"));
    expect(await fetchMemberDetail("guid-1")).toBeNull();
  });
});

describe("fetchRefereeLevel", () => {
  it("returns the highest-mapped referee level", async () => {
    const { TAG_CODE_TO_LEVEL } = await import("../lib/types");
    const codes = Object.keys(TAG_CODE_TO_LEVEL);
    mockFetch(jsonResponse(codes.map((c) => ({ tagCode: c }))));

    const level = await fetchRefereeLevel("100");

    expect(level).toBe(TAG_CODE_TO_LEVEL[codes[codes.length - 1]]);
  });

  it("returns null when no tags map to a level", async () => {
    mockFetch(jsonResponse([]));
    expect(await fetchRefereeLevel("100")).toBeNull();
  });

  it("returns null on non-OK responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    expect(await fetchRefereeLevel("100")).toBeNull();
  });
});

describe("getToken / mgmtFetch", () => {
  // These tests share module-level accessToken state via the static import, so
  // re-import fresh copies to keep the token cache independent per test.
  async function freshModule() {
    vi.resetModules();
    return import("../scripts/sync-users");
  }

  it("getToken exchanges an M2M token", async () => {
    mockFetch(jsonResponse({ access_token: "abc" }));
    expect(await getToken()).toBe("abc");
  });

  it("getToken throws on failure", async () => {
    mockFetch(errorResponse(400, "bad"));
    await expect(getToken()).rejects.toThrow();
  });

  it("mgmtFetch retries on 429 and succeeds on the retry", async () => {
    vi.useFakeTimers();
    const { mgmtFetch } = await freshModule();
    // First call inside this fresh module fetches the M2M token, then the endpoint.
    mockFetch(jsonResponse({ access_token: "tok" }), errorResponse(429, "rate limited"), jsonResponse({ ok: true }));

    const promise = mgmtFetch("/users?page=0", {}, 1);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ ok: true });
  });

  it("mgmtFetch throws on persistent non-429 errors", async () => {
    const { mgmtFetch } = await freshModule();
    mockFetch(jsonResponse({ access_token: "tok" }), errorResponse(403, "forbidden"));
    await expect(mgmtFetch("/users", {}, 1)).rejects.toThrow();
  });
});

describe("fetchAllAuth0Users", () => {
  it("fetches a single page and breaks when it returns fewer than the page size", async () => {
    vi.resetModules();
    const { fetchAllAuth0Users } = await import("../scripts/sync-users");
    // getToken call, then the users page.
    mockFetch(jsonResponse({ access_token: "tok" }), jsonResponse({ users: [{ email: "a@x.nl", user_id: "auth0|1" }] }));
    const users = await fetchAllAuth0Users();
    expect(users).toEqual([{ email: "a@x.nl", user_id: "auth0|1" }]);
  });
});

describe("createAuth0User", () => {
  it("creates a user and sends a password-change ticket", async () => {
    vi.resetModules();
    const { createAuth0User } = await import("../scripts/sync-users");
    const fetchMock = mockFetch(
      jsonResponse({ access_token: "tok" }),
      jsonResponse({ user_id: "auth0|new" }),
      jsonResponse({ ok: true }),
    );

    const result = await createAuth0User({ email: "a@x.nl", name: "Anna Bakker" });

    expect(result).toEqual({ user_id: "auth0|new", created: true });

    const calls = fetchMock.mock.calls;
    const createCall = calls.find(([url]) => String(url).includes("/api/v2/users"));
    expect(createCall).toBeDefined();
    const [ , createInit ] = createCall!;
    expect(createInit?.method).toBe("POST");
    const createBody = JSON.parse(createInit!.body as string);
    expect(createBody.email).toBe("a@x.nl");
    expect(createBody.name).toBe("Anna Bakker");
    expect(createBody.connection).toBe("Username-Password-Authentication");
    expect(createBody.email_verified).toBe(false);
    expect(typeof createBody.password).toBe("string");
    expect(createBody.password.length).toBeGreaterThan(8);

    const ticketCall = calls.find(([url]) => String(url).includes("/api/v2/tickets/password-change"));
    expect(ticketCall).toBeDefined();
    const [, ticketInit] = ticketCall!;
    const ticketBody = JSON.parse(ticketInit!.body as string);
    expect(ticketBody.user_id).toBe("auth0|new");
    expect(ticketBody.mark_email_as_verified).toBe(true);
  });

  it("links an existing user when create returns 409", async () => {
    vi.resetModules();
    const { createAuth0User } = await import("../scripts/sync-users");
    mockFetch(
      jsonResponse({ access_token: "tok" }),
      errorResponse(409, "user already exists"),
      jsonResponse([{ email: "a@x.nl", user_id: "auth0|existing" }]),
    );

    const result = await createAuth0User({ email: "a@x.nl", name: "Anna Bakker" });

    expect(result).toEqual({ user_id: "auth0|existing", created: false });
  });

  it("rethrows when create fails with a non-409 error", async () => {
    vi.resetModules();
    const { createAuth0User } = await import("../scripts/sync-users");
    mockFetch(jsonResponse({ access_token: "tok" }), errorResponse(403, "forbidden"));

    await expect(createAuth0User({ email: "a@x.nl", name: "Anna Bakker" })).rejects.toThrow(/403/);
  });
});

describe("getAuth0UserByEmail", () => {
  it("returns the first matching user", async () => {
    vi.resetModules();
    const { getAuth0UserByEmail } = await import("../scripts/sync-users");
    mockFetch(
      jsonResponse({ access_token: "tok" }),
      jsonResponse([
        { email: "a@x.nl", user_id: "auth0|1" },
        { email: "a@x.nl", user_id: "auth0|2" },
      ]),
    );

    expect(await getAuth0UserByEmail("a@x.nl")).toEqual({ email: "a@x.nl", user_id: "auth0|1" });
  });

  it("returns null when no user matches", async () => {
    vi.resetModules();
    const { getAuth0UserByEmail } = await import("../scripts/sync-users");
    mockFetch(jsonResponse({ access_token: "tok" }), jsonResponse([]));

    expect(await getAuth0UserByEmail("a@x.nl")).toBeNull();
  });
});

describe("upsertUser", () => {
  it("creates a user with all fields and upserts on email", async () => {
    const db = createMockDb();
    await upsertUser(asDb(db), {
      email: "a@x.nl",
      firstName: "Anna",
      lastNamePrefix: null,
      lastName: "Bakker",
      nbbNumber: "100",
      foysUserId: "g-1",
      auth0Sub: "auth0|1",
      refereeLevel: "E",
      memberSince: null,
    });

    expect(db.orm.public.User.upsert).toHaveBeenCalledWith({
      create: {
        email: "a@x.nl",
        firstName: "Anna",
        lastNamePrefix: null,
        lastName: "Bakker",
        nbbNumber: "100",
        foysUserId: "g-1",
        auth0Sub: "auth0|1",
        refereeLevel: "E",
        memberSince: null,
      },
      update: {
        firstName: "Anna",
        lastName: "Bakker",
        nbbNumber: "100",
        foysUserId: "g-1",
        auth0Sub: "auth0|1",
        refereeLevel: "E",
      },
      conflictOn: { email: "a@x.nl" },
    });
  });

  it("excludes null fields from the update payload", async () => {
    const db = createMockDb();
    await upsertUser(asDb(db), {
      email: "a@x.nl",
      firstName: null,
      lastNamePrefix: null,
      lastName: null,
      nbbNumber: null,
      foysUserId: null,
      auth0Sub: null,
      refereeLevel: null,
      memberSince: null,
    });

    expect(db.orm.public.User.upsert).toHaveBeenCalledWith({
      create: {
        email: "a@x.nl",
        firstName: null,
        lastNamePrefix: null,
        lastName: null,
        nbbNumber: null,
        foysUserId: null,
        auth0Sub: null,
        refereeLevel: null,
        memberSince: null,
      },
      update: {},
      conflictOn: { email: "a@x.nl" },
    });
  });
});