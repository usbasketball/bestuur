import { builder } from "../builder";
import { db } from "@/lib/db";
import { assertBestuur } from "@/lib/api-auth";
import { normalizeSeason, loadUsers, loadMemberContext, memberRecord } from "../loaders";
import { TaskAssigneeRef } from "../types/task";

builder.mutationFields((t) => ({
  upsertTaskAssignment: t.field({
    type: TaskAssigneeRef,
    nullable: true,
    args: {
      assignmentId: t.arg.string({ required: false }),
      taskId: t.arg.string({ required: true }),
      memberId: t.arg.string({ required: false }),
      season: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      await assertBestuur(ctx);
      const { assignmentId, taskId, memberId } = args;
      const season = normalizeSeason(args.season);

      const assignment = assignmentId
        ? await db.orm.public.TaskAssignment.where((a) => a.id.eq(assignmentId)).first()
        : null;

      if (assignmentId && !assignment) {
        throw new Error("Assignment not found");
      }

      if (assignment && assignment.status !== "DRAFT") {
        throw new Error("Assignment is not in DRAFT status");
      }

      const task = await db.orm.public.Task.where((t) => t.id.eq(taskId)).first();
      if (!task) throw new Error("Task not found");

      const newUserId = memberId ?? null;

      if (newUserId) {
        const existingForUser = await db.orm.public.TaskAssignment.where(
          (a) => a.taskId.neq(taskId),
        ).where((a) => a.userId.eq(newUserId)).first();
        if (existingForUser) {
          await db.orm.public.TaskAssignment.where((a) => a.id.eq(existingForUser.id)).deleteAndCount();
        }
      }

      if (assignment) {
        const existingOnTask = await db.orm.public.TaskAssignment.where(
          (a) => a.taskId.eq(taskId),
        ).where((a) => a.id.neq(assignment.id)).first();
        if (existingOnTask) {
          await db.orm.public.TaskAssignment.where((a) => a.id.eq(existingOnTask.id)).deleteAndCount();
        }
        await db.orm.public.TaskAssignment.where((a) => a.id.eq(assignment.id)).update({
          userId: newUserId,
          nbbNumber: null,
        });
      } else {
        await db.orm.public.TaskAssignment.create({
          taskId,
          userId: newUserId,
          nbbNumber: null,
          isDouble: false,
          status: "DRAFT",
        });
      }

      const updated = await db.orm.public.TaskAssignment.where(
        (a) => a.taskId.eq(taskId),
      ).first();

      if (!updated) throw new Error("Failed to upsert assignment");

      const memberCtx = await loadMemberContext(season);
      let member = null;
      if (updated.userId) {
        const users = await loadUsers([updated.userId]);
        if (users[0]) member = memberRecord(users[0], season, memberCtx);
      }

      return { assignmentId: updated.id, taskId, status: updated.status, member };
    },
  }),
}));
