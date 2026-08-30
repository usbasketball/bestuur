export const SEASONS = [
  "2026-2027",
  "2025-2026",
  "2024-2025",
  "2023-2024",
  "2022-2023",
  "2021-2022",
  "2020-2021",
  "2019-2020",
  "2018-2019",
  "2017-2018",
];

export type Season = (typeof SEASONS)[number];

// Derive the season key from a year/month (e.g. a match date). Seasons run
// across a year boundary and end in summer: Jan–Jul → "year-1-year",
// Aug–Dec → "year-year+1". Accepts any object with `year`/`month`, including a
// Temporal.PlainDateTime.
export function seasonFromDate(date: { year: number; month: number }): string {
  const startYear = date.month >= 1 && date.month <= 7 ? date.year - 1 : date.year;
  return `${startYear}-${startYear + 1}`;
}