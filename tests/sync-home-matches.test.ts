import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMatchesForTeam, queryTeams, upsertMatch } from "../scripts/sync-home-matches";
import { jsonResponse, errorResponse, mockFetch } from "./helpers/mock-fetch";
import { createMockDb, asDb } from "./helpers/mock-orm";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMatchesForTeam", () => {
  it("paginates matches with teamId filtering", async () => {
    const page1 = Array.from({ length: 30 }, (_, i) => ({ id: i + 1 }));
    const fetchMock = mockFetch(
      jsonResponse({ totalCount: 31, items: page1 }),
      jsonResponse({ totalCount: 31, items: [{ id: 31 }] }),
    );

    const matches = await fetchMatchesForTeam(99);

    expect(matches).toHaveLength(31);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("teamId")).toBe("99");
    expect(url.searchParams.get("showOnlyMatchesWithOrganisationsTeams")).toBe("true");
    expect(url.searchParams.get("showMatchesWhereClubIsAwayTeam")).toBe("false");
  });

  it("returns an empty array when there are no matches", async () => {
    mockFetch(jsonResponse({ totalCount: 0, items: [] }));
    expect(await fetchMatchesForTeam(1)).toEqual([]);
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(400, "bad"));
    await expect(fetchMatchesForTeam(1)).rejects.toThrow(/400/);
  });
});

describe("queryTeams", () => {
  const teamRows = [
    { foysCompetitionTeamId: 1, name: "MSE-1", season: "2026-2027", teamType: "MSE1" },
    { foysCompetitionTeamId: 2, name: "MSE-2", season: "2026-2027", teamType: "MSE2" },
    { foysCompetitionTeamId: 3, name: "MSE-1", season: "2025-2026", teamType: "MSE1" },
  ];

  it("returns all teams when no filter is given", async () => {
    const db = createMockDb({ Team: teamRows });
    const result = await queryTeams(asDb(db));
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ foysCompetitionTeamId: 1, name: "MSE-1", season: "2026-2027", teamType: "MSE1" });
  });

  it("filters by season using a where clause", async () => {
    const db = createMockDb({ Team: teamRows });
    const result = await queryTeams(asDb(db), { season: "2026-2027" });
    expect(result).toHaveLength(2);
    const chain = db.orm.public.Team.select.mock.results[0].value;
    expect(chain.where).toHaveBeenCalledWith({ season: "2026-2027" });
    expect(result.every((t) => t.season === "2026-2027")).toBe(true);
  });

  it("filters by teamType case-insensitively in JS after an unscoped select", async () => {
    const db = createMockDb({ Team: teamRows });
    const result = await queryTeams(asDb(db), { teamType: "mse1" });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.teamType === "MSE1")).toBe(true);
  });

  it("filters by both season and teamType", async () => {
    const db = createMockDb({ Team: teamRows });
    const result = await queryTeams(asDb(db), { season: "2026-2027", teamType: "MSE1" });
    expect(result).toHaveLength(1);
    expect(result[0].foysCompetitionTeamId).toBe(1);
  });
});

describe("upsertMatch", () => {
  it("upserts on foysMatchId with create and update payloads", async () => {
    const db = createMockDb();
    await upsertMatch(asDb(db), {
      foysMatchId: 555,
      status: "PLANNED",
      date: Temporal.PlainDateTime.from("2026-10-04T12:00:00"),
      startTime: "12:00:00",
      isFriendly: false,
      homeScore: null,
      awayScore: null,
      homeTeamFoysId: 10,
      awayTeamFoysId: 20,
      awayTeamName: "Rival",
      awayOrganisationId: "org-2",
      awayOrganisationName: "Rival Club",
      competitionId: 7,
      competitionTypeName: "NBB 1e klasse",
      field: null,
    });

    expect(db.orm.public.Match.upsert).toHaveBeenCalledTimes(1);
    const args = (db.orm.public.Match.upsert.mock.calls as unknown as Array<[{ conflictOn: Record<string, unknown>; create: Record<string, unknown>; update: Record<string, unknown> }]>)[0][0];
    expect(args.conflictOn).toEqual({ foysMatchId: 555 });
    expect(args.create).toMatchObject({
      foysMatchId: 555,
      status: "PLANNED",
      awayTeamName: "Rival",
      competitionId: 7,
    });
    expect(args.update).toMatchObject({
      status: "PLANNED",
      awayTeamName: "Rival",
    });
  });
});