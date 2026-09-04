import type { TaskAssignee } from "./task-assignee";

export type MatchTasks = {
  hallDuty: TaskAssignee | null;
  referee1: TaskAssignee | null;
  referee2: TaskAssignee | null;
  scorer: TaskAssignee | null;
  timer: TaskAssignee | null;
  shotClock: TaskAssignee | null;
};
