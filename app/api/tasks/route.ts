import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";

export async function GET() {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;

  const assignments = await db.orm.public.TaskAssignment.select(
    "id",
    "taskId",
    "userId",
    "isDouble",
  )
    .include("task", (t) => t.select("id", "taskType", "matchId").include("match", (m) => m.select("id", "date")))
    .include("user", (u) => u.select("id", "firstName", "lastName", "email"))
    .all();

  const data = assignments.map((a) => ({
    id: a.id,
    taskId: a.taskId,
    taskType: a.task.taskType,
    matchId: a.task.matchId,
    matchDate: a.task.match.date,
    userId: a.userId,
    userName: `${a.user.firstName ?? ""} ${a.user.lastName ?? ""}`.trim(),
    userEmail: a.user.email,
    isDouble: a.isDouble,
  }));

  return NextResponse.json(data);
}