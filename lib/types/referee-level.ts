// Diploma hierarchy (lowest → highest)
export const REFEREE_LEVELS = ["F", "BS2", "E", "BS3", "BS4"] as const;

export type RefereeLevel = (typeof REFEREE_LEVELS)[number];

// FOYS tag codes → canonical level names
// Legacy: F (equivalent to BS2), E (equivalent to BS3)
// Current: BS2, BS3, BS4
export const TAG_CODE_TO_LEVEL: Record<string, RefereeLevel> = {
  F: "F",
  SF: "F",
  E: "E",
  SE: "E",
  BS2: "BS2",
  BS3: "BS3",
  BS4: "BS4",
};
