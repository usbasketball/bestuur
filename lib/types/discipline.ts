export const DISCIPLINES = ["DISCIPLINE_5x5", "DISCIPLINE_3x3"] as const;

export type Discipline = (typeof DISCIPLINES)[number];
