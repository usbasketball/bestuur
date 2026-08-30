import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";
import { SEASONS, type Season } from "@/lib/types";
import type { MatchesResponse } from "@/lib/types";

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

  const homeTeamFoysIds = homeTeams.map((t) => t.foysCompetitionTeamId);

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
    "field",
  )
    .where((m) => m.homeTeamFoysId.in(homeTeamFoysIds))
    .orderBy([(m) => m.date.asc(), (m) => m.startTime.asc()])
    .all();

  const data: MatchesResponse = {
    homeTeams: homeTeams.map((t) => ({
      foysCompetitionTeamId: t.foysCompetitionTeamId,
      name: t.name,
      teamType: t.teamType,
    })),
    matches: matches.map((match) => ({
      id: match.id,
      foysMatchId: match.foysMatchId,
      status: match.status,
      date: match.date.toPlainDate().toString(),
      startTime: match.startTime,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      homeTeamFoysId: match.homeTeamFoysId,
      awayTeamFoysId: match.awayTeamFoysId,
      awayTeamName: match.awayTeamName,
      awayOrganisationName: match.awayOrganisationName,
      field: match.field,
    })),
  };

  return NextResponse.json(data);
}