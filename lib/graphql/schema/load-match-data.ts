import { db } from "@/lib/db";
import type { Season, TeamType } from "@/lib/types";
import type { MatchGql } from "./types/match";
import type { TaskAssigneeGql } from "./types/task";
import { loadMemberContext, memberRecord, buildUser } from "./loaders";

type MatchDbRow = {
  id: string;
  foysMatchId: number;
  status: string;
  date: { toPlainDate(): { toString(): string } };
  startTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamFoysId: number;
  awayTeamFoysId: number | null;
  awayTeamName: string | null;
  awayOrganisationName: string | null;
  awayOrganisationId: string | null;
  field: string | null;
};

function buildMatch(match: MatchDbRow, homeTeamTypeByFoysId: Map<number, TeamType>): MatchGql {
  return {
    id: match.id,
    foysMatchId: match.foysMatchId,
    status: match.status as MatchGql["status"],
    date: match.date.toPlainDate().toString(),
    startTime: match.startTime,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeTeam: homeTeamTypeByFoysId.get(match.homeTeamFoysId) ?? null,
    awayTeam: {
      foysId: match.awayTeamFoysId ?? 0,
      name: match.awayTeamName,
      organisation: match.awayOrganisationId
        ? {
            name: match.awayOrganisationName ?? "",
            foysId: match.awayOrganisationId,
          }
        : null,
    },
    field: match.field as MatchGql["field"],
    tasks: {
      hallDuty: null,
      referee1: null,
      referee2: null,
      scorer: null,
      timer: null,
      shotClock: null,
    },
  };
}

/**
 * Batch-load all home matches for a season with their task assignments.
 * Returns GraphQL match parents with tasks populated. This is the single loader
 * backing the `matches` query (and the tasks view).
 */
export async function loadMatchData(season: Season): Promise<MatchGql[]> {
  const homeTeams = await db.orm.public.Team.select(
    "foysCompetitionTeamId",
    "name",
    "teamType",
  )
    .where((t) => t.season.eq(season))
    .all();

  const homeTeamFoysIds = new Set(homeTeams.map((t) => t.foysCompetitionTeamId));
  const homeTeamTypeByFoysId = new Map<number, TeamType>(
    homeTeams.map((t) => [t.foysCompetitionTeamId, t.teamType as TeamType] as const),
  );

  const matches = await db.orm.public.Match.select(
    "id",
    "foysMatchId",
    "status",
    "date",
    "startTime",
    "homeScore",
    "awayScore",
    "homeTeamFoysId",
    "awayTeamFoysId",
    "awayTeamName",
    "awayOrganisationName",
    "awayOrganisationId",
    "field",
  )
    .where((m) => m.homeTeamFoysId.in([...homeTeamFoysIds]))
    .where((m) => m.status.neq("WITHDRAWN"))
    .orderBy([(m) => m.date.asc(), (m) => m.startTime.asc(), (m) => m.field.asc()])
    .all();

  const matchByMatchId = new Map<string, MatchGql>();
  for (const m of matches) {
    matchByMatchId.set(m.id, buildMatch(m, homeTeamTypeByFoysId));
  }

  const assignments = await db.orm.public.TaskAssignment.select(
    "id",
    "taskId",
    "userId",
    "nbbNumber",
    "isDouble",
    "status",
  )
    .include("task", (t) => t.select("id", "taskType", "matchId"))
    .include("user", (u) =>
      u.select(
        "id",
        "email",
        "firstName",
        "lastNamePrefix",
        "lastName",
        "nbbNumber",
        "refereeLevel",
        "foysUserId",
        "memberSince",
      ),
    )
    .all();

  const memberCtx = await loadMemberContext(season);

  const taskRows = assignments
    .filter((a) => matchByMatchId.has(a.task.matchId))
    .map((a): { taskMatchId: string; taskType: string; assignment: TaskAssigneeGql } => ({
      taskMatchId: a.task.matchId,
      taskType: a.task.taskType,
      assignment: {
        assignmentId: a.id,
        taskId: a.taskId,
        status: a.status,
        member: a.user
          ? memberRecord(buildUser(a.user), season, memberCtx)
          : null,
      },
    }));

  for (const row of taskRows) {
    const match = matchByMatchId.get(row.taskMatchId);
    if (!match) continue;
    const tasks = match.tasks;
    if (row.taskType === "HALL_DUTY") {
      tasks.hallDuty = row.assignment;
    } else if (row.taskType === "REFEREE") {
      if (!tasks.referee1) tasks.referee1 = row.assignment;
      else if (!tasks.referee2) tasks.referee2 = row.assignment;
    } else if (row.taskType === "TABLE_SCORER") {
      tasks.scorer = row.assignment;
    } else if (row.taskType === "TABLE_TIMER") {
      tasks.timer = row.assignment;
    } else if (row.taskType === "TABLE_24S_SHOT_CLOCK") {
      tasks.shotClock = row.assignment;
    }
  }

  return [...matchByMatchId.values()];
}
