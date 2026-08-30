import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";
import type { TeamsResponse } from "@/lib/types";

export async function GET() {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;

  const teams = await db.orm.public.Team.select(
    "id",
    "foysCompetitionTeamId",
    "foysTeamId",
    "name",
    "season",
    "teamType",
    "discipline",
  )
    .orderBy([(t) => t.season.desc(), (t) => t.teamType.asc()])
    .all();

  const data: TeamsResponse = teams.map((team) => ({
    id: team.id,
    foysCompetitionTeamId: team.foysCompetitionTeamId,
    foysTeamId: team.foysTeamId,
    name: team.name,
    season: team.season,
    teamType: team.teamType,
    discipline: team.discipline,
  }));

  return NextResponse.json(data);
}