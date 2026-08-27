export const DISCIPLINES = ["DISCIPLINE_5x5", "DISCIPLINE_3x3"] as const;

export type Discipline = (typeof DISCIPLINES)[number];

export function formatDiscipline(discipline: string): string {
  switch (discipline) {
    case "DISCIPLINE_5x5":
      return "5x5";
    case "DISCIPLINE_3x3":
      return "3x3";
    default:
      return discipline;
  }
}
