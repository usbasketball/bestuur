import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPlanAssignments,
  fetchTeamMembers,
  seasonFromEndDate,
  seasonFromDates,
  choosePlan,
  queryUsers,
  queryTeamsWithFoysId,
  buildPrimaryTeamMap,
  upsertClubMembership,
} from "../scripts/sync-club-memberships";
import { jsonResponse, errorResponse, mockFetch } from "./helpers/mock-fetch";
import { createMockDb, asDb } from "./helpers/mock-orm";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("seasonFromEndDate", () => {
  it("maps Jan–Jul end dates to the previous season", () => {
    expect(seasonFromEndDate("2026-01-15")).toBe("2025-2026");
    expect(seasonFromEndDate("2026-07-31")).toBe("2025-2026");
    expect(seasonFromEndDate("2025-06-30")).toBe("2024-2025");
  });

  it("maps Aug–Dec end dates to the same season", () => {
    expect(seasonFromEndDate("2026-08-01")).toBe("2026-2027");
    expect(seasonFromEndDate("2026-12-31")).toBe("2026-2027");
  });

  it("returns null for invalid or missing dates", () => {
    expect(seasonFromEndDate("")).toBeNull();
    expect(seasonFromEndDate(null)).toBeNull();
    expect(seasonFromEndDate(undefined)).toBeNull();
    expect(seasonFromEndDate("not-a-date")).toBeNull();
  });
});

describe("seasonFromDates", () => {
  it("uses the end date when present", () => {
    expect(seasonFromDates("2025-09-01", "2026-07-31")).toBe("2025-2026");
  });

  it("falls back to the start date when the end date is null", () => {
    expect(seasonFromDates("2026-08-01", null)).toBe("2026-2027");
    expect(seasonFromDates(undefined, "2027-07-31")).toBe("2026-2027");
  });

  it("returns null when both dates are unusable", () => {
    expect(seasonFromDates(null, null)).toBeNull();
    expect(seasonFromDates("", "not-a-date")).toBeNull();
  });
});

describe("choosePlan", () => {
  const plan = (overrides: Record<string, unknown> = {}) => ({
    startDate: "2025-09-01",
    endDate: "2026-07-31",
    planName: null,
    cancellationDate: null,
    plan: { tenantType: "Club", isMatchLicense: false, name: null },
    ...overrides,
  });

  it("prefers COMPETITION over RECREATIONAL", () => {
    const chosen = choosePlan([
      plan({ plan: { tenantType: "Club", isMatchLicense: false, name: "Recreanten" } }),
      plan({ plan: { tenantType: "Club", isMatchLicense: false, name: "Wedstrijdspelend" } }),
    ]);
    expect(chosen.type).toBe("COMPETITION");
    expect(chosen.plan.plan?.name).toBe("Wedstrijdspelend");
  });

  it("falls back to RECREATIONAL when no competition plan exists", () => {
    const chosen = choosePlan([
      plan({ plan: { tenantType: "Club", isMatchLicense: false, name: "Niet-spelend lid" } }),
      plan({ plan: { tenantType: "Club", isMatchLicense: false, name: "Recreanten" } }),
    ]);
    expect(chosen.type).toBe("RECREATIONAL");
    expect(chosen.plan.plan?.name).toBe("Niet-spelend lid");
  });

  it("returns a null type when no plan maps", () => {
    const chosen = choosePlan([plan({ plan: { tenantType: "Club", isMatchLicense: false, name: "Onbekend" } })]);
    expect(chosen.type).toBeNull();
  });

  it("honours the top-level planName fallback", () => {
    const chosen = choosePlan([
      plan({ plan: null, planName: "Wedstrijdspelend 1x" }),
    ]);
    expect(chosen.type).toBe("COMPETITION");
  });
});

describe("fetchPlanAssignments", () => {
  it("returns the array of assignments", async () => {
    mockFetch(jsonResponse([{ startDate: "2025-09-01" }, { startDate: "2026-09-01" }]));
    const result = await fetchPlanAssignments("guid-1");
    expect(result).toHaveLength(2);
  });

  it("returns an empty array for a null body", async () => {
    mockFetch(jsonResponse(null));
    expect(await fetchPlanAssignments("guid-1")).toEqual([]);
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    await expect(fetchPlanAssignments("guid-1")).rejects.toThrow(/500/);
  });
});

describe("fetchTeamMembers", () => {
  it("returns the members and requests per-team query params", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ totalCount: 2, items: [{ id: 1, personId: "g-1", teamId: 68463, end: "2027-07-31" }, { id: 2, personId: "g-2", teamId: 68463, end: "2027-07-31" }] }),
    );
    const members = await fetchTeamMembers(68463);
    expect(members).toHaveLength(2);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/teams/68463/members");
    expect(String(url)).toContain("teamId=68463");
    expect(String(url)).toContain("activeMembers=true");
    expect(String(url)).toContain("maxResultCount=30");
  });

  it("returns an empty array for a body without items", async () => {
    mockFetch(jsonResponse({ totalCount: 0 }));
    expect(await fetchTeamMembers(68463)).toEqual([]);
  });

  it("paginates through multiple pages", async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: i, personId: `g-${i}`, end: "2027-07-31" }));
    mockFetch(
      jsonResponse({ totalCount: 45, items: many }),
      jsonResponse({ totalCount: 45, items: many.slice(0, 15) }),
    );
    const members = await fetchTeamMembers(68463);
    expect(members).toHaveLength(45);
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    await expect(fetchTeamMembers(68463)).rejects.toThrow(/500/);
  });
});

describe("buildPrimaryTeamMap", () => {
  const teams = [
    { foysTeamId: 68465, teamType: "VSE1" as const, season: "2026-2027", name: "D1" },
    { foysTeamId: 68470, teamType: "MSE1" as const, season: "2026-2027", name: "H1" },
  ];

  it("maps person+season to the team's type", () => {
    const membersByTeam = new Map<number, unknown[]>([
      [68465, [{ personId: "g-1", end: "2027-07-31" }]],
    ]);
    const map = buildPrimaryTeamMap(teams, membersByTeam as never);
    expect(map.get("g-1|2026-2027")).toBe("VSE1");
  });

  it("uses first team wins when a person is in multiple teams in a season", () => {
    const membersByTeam = new Map<number, unknown[]>([
      [68470, [{ personId: "g-1", end: "2027-07-31" }]],
      [68465, [{ personId: "g-1", end: "2027-07-31" }]],
    ]);
    const map = buildPrimaryTeamMap(teams, membersByTeam as never);
    // Ordered by TEAM_TYPES (VSE1 before MSE1), not by team id.
    expect(map.get("g-1|2026-2027")).toBe("VSE1");
  });

  it("orders by TEAM_TYPES, not team id", () => {
    const vse6 = { foysTeamId: 999, teamType: "VSE6" as const, season: "2026-2027", name: "D6" };
    const mse1 = { foysTeamId: 1, teamType: "MSE1" as const, season: "2026-2027", name: "H1" };
    const membersByTeam = new Map<number, unknown[]>([
      [1, [{ personId: "g-1", end: "2027-07-31" }]],
      [999, [{ personId: "g-1", end: "2027-07-31" }]],
    ]);
    const map = buildPrimaryTeamMap([mse1, vse6], membersByTeam as never);
    // TEAM_TYPES order puts VSE6 before MSE1, so VSE6 wins despite the higher id.
    expect(map.get("g-1|2026-2027")).toBe("VSE6");
  });

  it("maps active members (null end) via their start date", () => {
    const membersByTeam = new Map<number, unknown[]>([
      [68465, [{ personId: "g-1", start: "2026-08-01", end: null }]],
    ]);
    const map = buildPrimaryTeamMap(teams, membersByTeam as never);
    expect(map.get("g-1|2026-2027")).toBe("VSE1");
  });

  it("skips members with unusable end dates", () => {
    const membersByTeam = new Map<number, unknown[]>([
      [68465, [{ personId: "g-1", end: null }]],
    ]);
    const map = buildPrimaryTeamMap(teams, membersByTeam as never);
    expect(map.size).toBe(0);
  });

  it("skips members without a personId", () => {
    const membersByTeam = new Map<number, unknown[]>([
      [68465, [{ personId: null, end: "2027-07-31" }]],
    ]);
    const map = buildPrimaryTeamMap(teams, membersByTeam as never);
    expect(map.size).toBe(0);
  });
});

describe("queryTeamsWithFoysId", () => {
  it("returns teams that have a foysTeamId", async () => {
    const db = createMockDb({
      Team: [
        { foysTeamId: 68465, teamType: "VSE1", season: "2026-2027", name: "D1" },
        { foysTeamId: null, teamType: "MSE1", season: "2026-2027", name: "H1" },
      ],
    });
    const teams = await queryTeamsWithFoysId(asDb(db));
    expect(teams).toEqual([
      { foysTeamId: 68465, teamType: "VSE1", season: "2026-2027", name: "D1" },
    ]);
    expect(db.orm.public.Team.select).toHaveBeenCalledWith("foysTeamId", "teamType", "season", "name");
  });
});

describe("queryUsers", () => {
  it("selects id, foysUserId and email for users with a foys id", async () => {
    const db = createMockDb({
      User: [
        { id: "u-1", foysUserId: "g-1", email: "a@x.nl" },
        { id: "u-2", foysUserId: null, email: "b@x.nl" },
      ],
    });
    const users = await queryUsers(asDb(db));
    expect(users).toEqual([
      { id: "u-1", foys_user_id: "g-1", email: "a@x.nl" },
      { id: "u-2", foys_user_id: null, email: "b@x.nl" },
    ]);
    expect(db.orm.public.User.select).toHaveBeenCalledWith("id", "foysUserId", "email");
  });
});

describe("upsertClubMembership", () => {
  it("upserts on (userId, season) with a full create payload", async () => {
    const db = createMockDb();
    await upsertClubMembership(asDb(db), {
      userId: "u-1",
      season: "2026-2027",
      primaryTeam: null,
      registeredTeam: null,
      membershipType: "COMPETITION",
      cancelledAt: null,
    });

    expect(db.orm.public.ClubMembership.upsert).toHaveBeenCalledWith({
      create: {
        userId: "u-1",
        season: "2026-2027",
        primaryTeam: null,
        registeredTeam: null,
        membershipType: "COMPETITION",
        cancelledAt: null,
      },
      update: { membershipType: "COMPETITION" },
      conflictOn: { userId: "u-1", season: "2026-2027" },
    });
  });

  it("includes non-null fields in the update payload", async () => {
    const db = createMockDb();
    await upsertClubMembership(asDb(db), {
      userId: "u-1",
      season: "2026-2027",
      primaryTeam: "MSE1",
      registeredTeam: "MSE1",
      membershipType: "RECREATIONAL",
      cancelledAt: Temporal.PlainDateTime.from("2026-03-01T00:00:00"),
    });

    expect(db.orm.public.ClubMembership.upsert).toHaveBeenCalledWith({
      create: {
        userId: "u-1",
        season: "2026-2027",
        primaryTeam: "MSE1",
        registeredTeam: "MSE1",
        membershipType: "RECREATIONAL",
        cancelledAt: Temporal.PlainDateTime.from("2026-03-01T00:00:00"),
      },
      update: {
        primaryTeam: "MSE1",
        registeredTeam: "MSE1",
        membershipType: "RECREATIONAL",
        cancelledAt: Temporal.PlainDateTime.from("2026-03-01T00:00:00"),
      },
      conflictOn: { userId: "u-1", season: "2026-2027" },
    });
  });
});