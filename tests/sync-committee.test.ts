import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchCommitteePersons,
  mapCommitteeType,
  queryUsers,
  queryCommittees,
} from "../scripts/sync-committee";
import { jsonResponse, errorResponse, mockFetch } from "./helpers/mock-fetch";
import { createMockDb, asDb } from "./helpers/mock-orm";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mapCommitteeType", () => {
  it("maps board roles to their enum values", () => {
    expect(mapCommitteeType("Voorzitter")).toBe("BOARD_CHAIRPERSON");
    expect(mapCommitteeType("Secretaris")).toBe("BOARD_SECRETARY");
    expect(mapCommitteeType("Penningmeester")).toBe("BOARD_TREASURER");
    expect(mapCommitteeType("Wedstrijdsecretaris")).toBe("BOARD_GAME_SECRETARY");
    expect(mapCommitteeType("Algemeen lid")).toBe("BOARD_GENERAL_MEMBER");
  });

  it("strips emoji decorations from roles", () => {
    expect(mapCommitteeType("Wedstrijdsecretaris 🚀")).toBe("BOARD_GAME_SECRETARY");
    expect(mapCommitteeType("Penningmeester 🍷✨")).toBe("BOARD_TREASURER");
  });

  it("is case- and space-insensitive", () => {
    expect(mapCommitteeType("  voorzitter ")).toBe("BOARD_CHAIRPERSON");
  });

  it("returns null for unknown or null roles", () => {
    expect(mapCommitteeType("Wekelijks klusje")).toBeNull();
    expect(mapCommitteeType(null)).toBeNull();
    expect(mapCommitteeType(undefined)).toBeNull();
    expect(mapCommitteeType("")).toBeNull();
  });

  it("prefers Wedstrijdsecretaris over Secretaris", () => {
    expect(mapCommitteeType("Wedstrijdsecretaris")).toBe("BOARD_GAME_SECRETARY");
  });
});

describe("fetchCommitteePersons", () => {
  it("fetches with the committee query params and returns items", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ totalCount: 2, items: [
        { id: 1, committeeId: 2909, personId: "g-1", role: "Voorzitter", position: 1, startDate: "2025-10-03", endDate: null },
        { id: 2, committeeId: 2909, personId: "g-2", role: "Secretaris", position: 2, startDate: "2025-10-03", endDate: null },
      ] }),
    );
    const persons = await fetchCommitteePersons(2909);
    expect(persons).toHaveLength(2);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/management/committee-persons");
    expect(String(url)).toContain("committeeId=2909");
    expect(String(url)).toContain("active=true");
    expect(String(url)).toContain("maxResultCount=100");
  });

  it("returns an empty array for a body without items", async () => {
    mockFetch(jsonResponse({ totalCount: 0 }));
    expect(await fetchCommitteePersons(2909)).toEqual([]);
  });

  it("throws on error responses", async () => {
    mockFetch(errorResponse(500, "boom"));
    await expect(fetchCommitteePersons(2909)).rejects.toThrow(/500/);
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
  });
});

describe("queryCommittees", () => {
  it("selects type and season for all committee rows", async () => {
    const db = createMockDb({
      Committee: [
        { type: "BOARD_CHAIRPERSON", season: "2026-2027" },
        { type: "BOARD_SECRETARY", season: "2026-2027" },
      ],
    });
    const rows = await queryCommittees(asDb(db));
    expect(rows).toEqual([
      { type: "BOARD_CHAIRPERSON", season: "2026-2027" },
      { type: "BOARD_SECRETARY", season: "2026-2027" },
    ]);
    expect(db.orm.public.Committee.select).toHaveBeenCalledWith("type", "season");
  });
});