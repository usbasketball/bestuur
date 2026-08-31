export const TEAM_TYPES = [
  "VSE1", "VSE2", "VSE3", "VSE4", "VSE5", "VSE6",
  "MSE1", "MSE2", "MSE3", "MSE4", "MSE5", "MSE6",
  "V3x3",
] as const;

export type TeamType = (typeof TEAM_TYPES)[number];

const VALID_TEAM_TYPES = new Set<string>(TEAM_TYPES);

// Map FOYS team name → TeamType.
// "MSE-2" → "MSE2", "3x3" → "V3x3", etc.
// Falls back to checking disciplines for "3x3 Basketball" if name doesn't match.
// Returns null if no mapping found.
export function mapTeamType(
  name: string | null | undefined,
  disciplines?: { name: string }[] | null,
): TeamType | null {
  if (!name) return null;
  const normalized = name.replace(/[-*\s]/g, "").trim().toUpperCase();
  if (normalized === "3X3") return "V3x3";
  if (VALID_TEAM_TYPES.has(normalized)) return normalized as TeamType;
  if (disciplines?.some((d) => d.name === "3x3 Basketball")) return "V3x3";
  return null;
}

// Abbreviate a TeamType for display: MSE2 → "H2", VSE4 → "D4",
// V3x3 → "V3x3".
export function abbreviateTeamType(teamType: string | null | undefined): string {
  if (!teamType) return "";
  const match = /^(MSE|VSE)(\d+)$/.exec(teamType.trim().toUpperCase());
  if (!match) return teamType;
  const prefix = match[1] === "MSE" ? "H" : "D";
  return `${prefix}${match[2]}`;
}
