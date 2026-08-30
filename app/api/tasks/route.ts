import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";
import { SEASONS, type Season } from "@/lib/types";
import type { TasksResponse } from "@/lib/types";

export async function GET(request: Request) {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "")
    ? (rawSeason as Season)
    : SEASONS[0];

  const homeTeams = await db.orm.public.Team.select(
    "foysCompetitionTeamId",
    "name",
    "teamType",
  )
    .where((t) => t.season.eq(season))
    .all();

  const homeTeamFoysIds = new Set(homeTeams.map((t) => t.foysCompetitionTeamId));
  const homeTeamByFoysId = new Map(
    homeTeams.map((t) => [t.foysCompetitionTeamId, t.name ?? t.teamType] as const),
  );

  const assignments = await db.orm.public.TaskAssignment.select(
    "id",
    "taskId",
    "userId",
    "nbbNumber",
    "isDouble",
  )
    .include("task", (t) =>
      t
        .select("id", "taskType", "matchId")
        .include("match", (m) =>
          m.select(
            "id",
            "foysMatchId",
            "date",
            "startTime",
            "homeTeamFoysId",
            "awayOrganisationName",
            "awayTeamName",
          ),
        ),
    )
    .include("user", (u) => u.select("firstName", "lastNamePrefix", "lastName", "email"))
    .all();

  const rows = assignments
    .filter((a) => homeTeamFoysIds.has(a.task.match.homeTeamFoysId))
    .sort(
      (a, b) =>
        a.task.match.date.toString().localeCompare(b.task.match.date.toString()) ||
        (a.task.match.startTime ?? "").localeCompare(b.task.match.startTime ?? ""),
    );

  const data: TasksResponse = rows.map((a) => ({
    id: a.id,
    taskId: a.task.id,
    taskType: a.task.taskType,
    matchId: a.task.match.id,
    foysMatchId: a.task.match.foysMatchId,
    matchDate: a.task.match.date.toPlainDate().toString(),
    matchStartTime: a.task.match.startTime,
    homeTeam: homeTeamByFoysId.get(a.task.match.homeTeamFoysId) ?? null,
    awayOrganisationName: a.task.match.awayOrganisationName,
    awayTeamName: a.task.match.awayTeamName,
    isDouble: a.isDouble,
    nbbNumber: a.nbbNumber,
    userName: a.user
      ? [a.user.firstName, a.user.lastNamePrefix, a.user.lastName]
          .filter(Boolean)
          .join(" ")
      : null,
    userEmail: a.user?.email ?? null,
  }));

  return NextResponse.json(data);
}