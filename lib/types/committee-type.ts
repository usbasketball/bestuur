export const COMMITTEE_TYPES = [
  "BOARD_CHAIRPERSON",
  "BOARD_SECRETARY",
  "BOARD_TREASURER",
  "BOARD_GAME_SECRETARY",
  "BOARD_GENERAL_MEMBER",
  "OMNI",
] as const;

export type CommitteeType = (typeof COMMITTEE_TYPES)[number];