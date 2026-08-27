export const MATCH_STATUSES = ["CANCELLED", "FINAL", "PLANNED", "WITHDRAWN"] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

const FOYS_STATUS_TO_ENUM: Record<string, MatchStatus> = {
  Cancelled: "CANCELLED",
  Final: "FINAL",
  Planned: "PLANNED",
  Withdrawn: "WITHDRAWN",
};

export function mapMatchStatus(status: string | null | undefined): MatchStatus | null {
  if (!status) return null;
  return FOYS_STATUS_TO_ENUM[status] ?? null;
}
