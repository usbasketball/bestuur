import type { TaskAssignmentStatus } from "@/lib/types";
import type { Member } from "./member";

export type TaskAssignee = {
  assignmentId: string;
  taskId: string;
  status: TaskAssignmentStatus;
  member: Member | null;
};
