import { describe, expect, it } from "vitest";
import {
  mapFieldType,
  formatFieldType,
  mapMatchStatus,
  mapTeamType,
  mapPlanMembershipType,
  mapClubMembershipType,
} from "../lib/types";

describe("mapTeamType", () => {
  it("maps hyphenated team names", () => {
    expect(mapTeamType("MSE-2")).toBe("MSE2");
    expect(mapTeamType("VSE-6**")).toBe("VSE6");
  });

  it("strips whitespace and uppercases", () => {
    expect(mapTeamType("  mse 1 ")).toBe("MSE1");
  });

  it("maps 3x3 by name", () => {
    expect(mapTeamType("3x3")).toBe("V3x3");
    expect(mapTeamType("3X3")).toBe("V3x3");
  });

  it("falls back to disciplines for 3x3 Basketball", () => {
    expect(mapTeamType("Basketball 3x3", [{ name: "3x3 Basketball" }])).toBe("V3x3");
  });

  it("returns null for unknown names without matching disciplines", () => {
    expect(mapTeamType("Recreanten")).toBeNull();
    expect(mapTeamType("Vrijtrainen")).toBeNull();
    expect(() => mapTeamType(null)).not.toThrow();
  });

  it("does not use 3x3 fallback when disciplines are absent", () => {
    expect(mapTeamType("Recreanten", [{ name: "5x5" }])).toBeNull();
  });
});

describe("mapMatchStatus", () => {
  it("maps known statuses", () => {
    expect(mapMatchStatus("Planned")).toBe("PLANNED");
    expect(mapMatchStatus("Final")).toBe("FINAL");
    expect(mapMatchStatus("Cancelled")).toBe("CANCELLED");
    expect(mapMatchStatus("Withdrawn")).toBe("WITHDRAWN");
  });

  it("returns null for unknown or empty statuses", () => {
    expect(mapMatchStatus("Scheduled")).toBeNull();
    expect(mapMatchStatus("")).toBeNull();
    expect(mapMatchStatus(null)).toBeNull();
  });
});

describe("mapFieldType", () => {
  it("maps known field names", () => {
    expect(mapFieldType("Center Court")).toBe("CENTER_COURT");
    expect(mapFieldType("Veld 1")).toBe("VELD_1");
    expect(mapFieldType("Veld 2")).toBe("VELD_2");
    expect(mapFieldType("Veld 3")).toBe("VELD_3");
  });

  it("returns null for unknown fields", () => {
    expect(mapFieldType("Veld 4")).toBeNull();
    expect(mapFieldType(null)).toBeNull();
  });
});

describe("formatFieldType", () => {
  it("formats enum values back to labels", () => {
    expect(formatFieldType("CENTER_COURT")).toBe("Center Court");
    expect(formatFieldType("VELD_1")).toBe("Veld 1");
  });

  it("passes through unknown values and null", () => {
    expect(formatFieldType("CUSTOM")).toBe("CUSTOM");
    expect(formatFieldType(null)).toBeNull();
  });
});

describe("mapPlanMembershipType", () => {
  it("maps match-license plans to COMPETITION regardless of name", () => {
    expect(mapPlanMembershipType("Recreanten", true)).toBe("COMPETITION");
  });

  it("maps wedstrijd plans to COMPETITION", () => {
    expect(mapPlanMembershipType("Wedstrijdspelend 2x trainen")).toBe("COMPETITION");
    expect(mapPlanMembershipType("Wedstrijdspelend")).toBe("COMPETITION");
  });

  it("maps recreational plans to RECREATIONAL", () => {
    expect(mapPlanMembershipType("Recreanten")).toBe("RECREATIONAL");
    expect(mapPlanMembershipType("3x3 lid")).toBe("RECREATIONAL");
    expect(mapPlanMembershipType("Niet-spelend lid")).toBe("RECREATIONAL");
  });

  it("case-insensitively matches plan names", () => {
    expect(mapPlanMembershipType("WEDSTRIJDSPELEND 1X")).toBe("COMPETITION");
    expect(mapPlanMembershipType("recreant")).toBe("RECREATIONAL");
  });

  it("returns null for unknown or empty names", () => {
    expect(mapPlanMembershipType("Sponsor")).toBeNull();
    expect(mapPlanMembershipType("")).toBeNull();
    expect(mapPlanMembershipType(null)).toBeNull();
  });
});

describe("mapClubMembershipType", () => {
  it("maps Dutch and English type labels", () => {
    expect(mapClubMembershipType("Competitie")).toBe("COMPETITION");
    expect(mapClubMembershipType("Competition")).toBe("COMPETITION");
    expect(mapClubMembershipType("Recreatief")).toBe("RECREATIONAL");
    expect(mapClubMembershipType("Recreational")).toBe("RECREATIONAL");
  });

  it("returns null for unknown or empty values", () => {
    expect(mapClubMembershipType("Anders")).toBeNull();
    expect(mapClubMembershipType("")).toBeNull();
    expect(mapClubMembershipType(null)).toBeNull();
  });
});