export const CLUB_MEMBERSHIP_TYPES = ["COMPETITION", "RECREATIONAL"] as const;
export type ClubMembershipType = (typeof CLUB_MEMBERSHIP_TYPES)[number];

const FOYS_TYPE_TO_ENUM: Record<string, ClubMembershipType> = {
  Competitie: "COMPETITION",
  Competition: "COMPETITION",
  Recreatief: "RECREATIONAL",
  Recreational: "RECREATIONAL",
};

export function mapClubMembershipType(type: string | null | undefined): ClubMembershipType | null {
  if (!type) return null;
  return FOYS_TYPE_TO_ENUM[type] ?? null;
}

// Map a FOYS club membership/plan assignment to a ClubMembershipType based on
// the plan name and match-license flag. Plan names are Dutch (e.g.
// "Wedstrijdspelend 2x trainen", "3x3 lid", "Recreanten", "Niet-spelend lid").
// A valid match license (NBB competition licence) always implies COMPETITION.
// "3x3 lid" and "Niet-spelend lid" are RECREATIONAL. "Recreant*" plans are
// RECREATIONAL, and "Wedstrijd*" plans are COMPETITION.
export function mapPlanMembershipType(
  planName: string | null | undefined,
  isMatchLicense?: boolean | null,
): ClubMembershipType | null {
  if (isMatchLicense) return "COMPETITION";
  const name = (planName || "").toLowerCase();
  if (!name) return null;
  if (name.includes("wedstrijd")) return "COMPETITION";
  if (name.includes("3x3") || name.includes("recreant") || name.includes("niet-spelend")) {
    return "RECREATIONAL";
  }
  return null;
}
