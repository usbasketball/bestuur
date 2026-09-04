import { builder } from "../builder";
import { MemberRef } from "./member";
import type { MemberGql } from "./member";
import type { TaskAssignmentStatus } from "@/lib/types";
import { TaskAssignmentStatusEnum } from "./enums";

/**
 * TaskAssignee DTO — a task assignment with its resolved member.
 * Built from `task_assignments` (+ `tasks` for the task id, resolves to Member via context).
 */
export type TaskAssigneeGql = {
  assignmentId: string;
  taskId: string;
  status: TaskAssignmentStatus;
  member: MemberGql | null;
};

export const TaskAssigneeRef = builder.objectRef<TaskAssigneeGql>("TaskAssignee");

TaskAssigneeRef.implement({
  description: "A task assignment on a match, with the assigned member (if any)",
  fields: (t) => ({
    assignmentId: t.exposeID("assignmentId"),
    taskId: t.exposeID("taskId"),
    status: t.expose("status", { type: TaskAssignmentStatusEnum }),
    member: t.field({
      type: MemberRef,
      nullable: true,
      resolve: (assignee) => assignee.member,
    }),
  }),
});

/**
 * MatchTasks DTO — a virtual grouping of a match's TaskAssignments by task type.
 */
export type MatchTasksGql = {
  hallDuty: TaskAssigneeGql | null;
  referee1: TaskAssigneeGql | null;
  referee2: TaskAssigneeGql | null;
  scorer: TaskAssigneeGql | null;
  timer: TaskAssigneeGql | null;
  shotClock: TaskAssigneeGql | null;
};

export const MatchTasksRef = builder.objectRef<MatchTasksGql>("MatchTasks");

MatchTasksRef.implement({
  description: "The task assignments for a match, grouped by task type slot",
  fields: (t) => ({
    hallDuty: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.hallDuty }),
    referee1: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.referee1 }),
    referee2: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.referee2 }),
    scorer: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.scorer }),
    timer: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.timer }),
    shotClock: t.field({ type: TaskAssigneeRef, nullable: true, resolve: (m) => m.shotClock }),
  }),
});
