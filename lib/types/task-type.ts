export const TASK_TYPES = [
  "HALL_DUTY",
  "REFEREE",
  "TABLE_SCORER",
  "TABLE_TIMER",
  "TABLE_24S_SHOT_CLOCK",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];