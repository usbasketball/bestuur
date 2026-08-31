export const TASK_ASSIGNMENT_STATUSES = ["PLANNED", "DRAFT"] as const;

export type TaskAssignmentStatus = (typeof TASK_ASSIGNMENT_STATUSES)[number];
