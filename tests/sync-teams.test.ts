import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchAllFoysTeams,
  fetchAllFoysGeneralTeams,
  mapTrainingTeamType,
  upsertTeam,
  upsertGeneralTeamId,
} from "../scripts/sync-teams";
import { jsonResponse, errorResponse, mockFetch } from "./helpers/mock-fetch";
import { createMockDb, asDb } from "./helpers/mock-orm";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapTrainingTeamType", () => {
  it("maps D{number} to VSE{number}", () => {
    expect(mapTrainingTeamType("D1")).toBe("VSE1");
    expect(mapTrainingTeamType("D6")).toBe("VSE6");
  });

  it("maps H{number} to MSE{number}", () => {
    expect(mapTrainingTeamType("H1")).toBe("MSE1");
    expect(mapTrainingTeamType("H5")).toBe("MSE5");
  });

  it("trims surrounding whitespace", () => {
    expect(mapTrainingTeamType("  H2  ")).toBe("MSE2");
  });

  it("returns null for non-training-team names", () => {
    expect(mapTrainingTeamType("Vrijtrainen")).toBeNull();
    expect(mapTrainingTeamType("MSE-1")).toBeNull();
    expect(mapTrainingTeamType("")).toBeNull();
    expect(mapTrainingTeamType(null)).toBeNull();
  });

  it("returns null for unsupported team numbers or prefixes", () => {
    expect(mapTrainingTeamType("D7")).toBeNull();
    expect(mapTrainingTeamType("X1")).toBeNull();
  });
});

describe("fetchAllFoysTeams", () => {
  it("paginates through all teams", async () => {
    const page1 = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, name: `MSE-${i + 1}` }));
    const page2 = [{ id: 31, name: "VSE-2" }];
    const fetchMock = mockFetch(jsonResponse({ totalCount: 31, items: page1 }), jsonResponse({ totalCount: 31, items: page2 }));

    const result = await fetchAllFoysTeams();

    expect(result.totalCount).toBe(31);
    expect(result.items).toHaveLength(31);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends paging query params and auth headers", async () => {
    const fetchMock = mockFetch(jsonResponse({ totalCount: 0, items: [] }));

    await fetchAllFoysTeams();

    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("skipCount")).toBe("0");
    expect(url.searchParams.get("maxResultCount")).toBe("30");
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-foys-api-key");
    expect(headers["X-Cluster"]).toBe("cluster-default");
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    await expect(fetchAllFoysTeams()).rejects.toThrow(/500/);
  });
});

describe("fetchAllFoysGeneralTeams", () => {
  it("request non-competition teams for the fixed season", async () => {
    const fetchMock = mockFetch(jsonResponse({ totalCount: 0, items: [] }));

    await fetchAllFoysGeneralTeams();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get("seasonId")).toBe("2792");
    expect(url.searchParams.get("isCompetitionTeam")).toBe("false");
    expect(url.searchParams.get("sorting")).toBe("name");
  });

  it("paginates general teams", async () => {
    const page1 = Array.from({ length: 30 }, (_, i) => ({ id: 10 + i, name: i === 0 ? "D1" : `H${i}` }));
    mockFetch(
      jsonResponse({ totalCount: 31, items: page1 }),
      jsonResponse({ totalCount: 31, items: [{ id: 41, name: "D2" }] }),
    );
    const result = await fetchAllFoysGeneralTeams();
    expect(result.totalCount).toBe(31);
    expect(result.items).toHaveLength(31);
  });
});

describe("upsertTeam", () => {
  it("uses foysCompetitionTeamId as the conflict key", async () => {
    const db = createMockDb();
    await upsertTeam(asDb(db), {
      foysCompetitionTeamId: 42,
      name: "MSE-1",
      season: "2026-2027",
      teamType: "MSE1",
      discipline: "DISCIPLINE_5x5",
    });

    expect(db.orm.public.Team.upsert).toHaveBeenCalledWith({
      create: {
        foysCompetitionTeamId: 42,
        name: "MSE-1",
        season: "2026-2027",
        teamType: "MSE1",
        discipline: "DISCIPLINE_5x5",
      },
      update: { name: "MSE-1", season: "2026-2027", teamType: "MSE1", discipline: "DISCIPLINE_5x5" },
      conflictOn: { foysCompetitionTeamId: 42 },
    });
  });

  it("maps 3x3 teams to the 3x3 discipline", async () => {
    const db = createMockDb();
    await upsertTeam(asDb(db), {
      foysCompetitionTeamId: 7,
      name: "3x3",
      season: "2026-2027",
      teamType: "V3x3",
      discipline: "DISCIPLINE_3x3",
    });
    expect(db.orm.public.Team.upsert).toHaveBeenCalledTimes(1);
  });
});

describe("upsertGeneralTeamId", () => {
  it("links foysTeamId onto the matching team row", async () => {
    const db = createMockDb({ Team: [{ id: "row-1", teamType: "VSE1", season: "2026-2027", name: "VSE1" }] });

    const result = await upsertGeneralTeamId(asDb(db), {
      foysTeamId: 68465,
      season: "2026-2027",
      teamType: "VSE1",
      name: "D1",
    });

    expect(result).toBe(true);
    expect(db.orm.public.Team.where).toHaveBeenNthCalledWith(1, { teamType: "VSE1", season: "2026-2027" });
    expect(db.orm.public.Team.where).toHaveBeenNthCalledWith(2, { id: "row-1" });
    expect(db.orm.public.Team.where.mock.results[0].value.first).toHaveBeenCalledTimes(1);
    expect(db.orm.public.Team.where.mock.results[1].value.update).toHaveBeenCalledWith({
      foysTeamId: 68465,
      name: "D1",
    });
  });

  it("returns false when no team row matches", async () => {
    const db = createMockDb({ Team: [] });
    const result = await upsertGeneralTeamId(asDb(db), {
      foysTeamId: 68465,
      season: "2026-2027",
      teamType: "VSE1",
      name: "D1",
    });
    expect(result).toBe(false);
    expect(db.orm.public.Team.where).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing row name when the general team has none", async () => {
    const db = createMockDb({ Team: [{ id: "row-1", teamType: "MSE1", season: "2026-2027", name: "MSE-1" }] });
    const result = await upsertGeneralTeamId(asDb(db), {
      foysTeamId: 1,
      season: "2026-2027",
      teamType: "MSE1",
      name: null,
    });
    expect(result).toBe(true);
    expect(db.orm.public.Team.where).toHaveBeenNthCalledWith(2, { id: "row-1" });
    expect(db.orm.public.Team.where.mock.results[1].value.update).toHaveBeenCalledWith({
      foysTeamId: 1,
      name: "MSE-1",
    });
  });
});