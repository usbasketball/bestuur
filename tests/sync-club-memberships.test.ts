import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchPlanAssignments,
  seasonFromEndDate,
  choosePlan,
  queryUsers,
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