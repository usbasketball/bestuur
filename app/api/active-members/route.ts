import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";
import { SEASONS, type Season } from "@/lib/types";
import type { ActiveMembersResponse } from "@/lib/types";

export async function GET(request: Request) {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const rawSeason = searchParams.get("season");
  const season = SEASONS.includes(rawSeason ?? "")
    ? (rawSeason as Season)
    : SEASONS[0];

  const [coaches, committees, hallDuties] = await Promise.all([
    db.orm.public.Coach.select("id", "team", "season")
      .include("user", (u) =>
        u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
      )
      .where((c) => c.season.eq(season))
      .all(),
    db.orm.public.Committee.select("id", "type", "season")
      .include("user", (u) =>
        u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
      )
      .where((c) => c.season.eq(season))
      .all(),
    db.orm.public.HallDuty.select("id", "season")
      .include("user", (u) =>
        u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
      )
      .where((h) => h.season.eq(season))
      .all(),
  ]);

  const data: ActiveMembersResponse = {
    coaches: coaches.map((c) => ({ id: c.id, team: c.team, user: c.user })),
    committees: committees.map((c) => ({ id: c.id, type: c.type, user: c.user })),
    hallDuties: hallDuties.map((h) => ({ id: h.id, user: h.user })),
  };

  return NextResponse.json(data);
}