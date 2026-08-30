import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireBestuur } from "@/lib/api-auth";
import { SEASONS } from "@/lib/types";
import type { MembersResponse } from "@/lib/types";

export async function GET() {
  const unauthorized = await requireBestuur();
  if (unauthorized) return unauthorized;

  const currentSeason = SEASONS[0];

  const users = await db.orm.public.User.select(
    "id",
    "email",
    "firstName",
    "lastNamePrefix",
    "lastName",
    "nbbNumber",
    "refereeLevel",
    "foysUserId",
    "memberSince",
  )
    .include("memberships", (m) =>
      m
        .where((x) => x.season.eq(currentSeason))
        .select("membershipType", "primaryTeam"),
    )
    .include("coaches", (c) =>
      c.where((x) => x.season.eq(currentSeason)).select("team"),
    )
    .orderBy([(u) => u.firstName.asc()])
    .all();

  const data: MembersResponse = users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastNamePrefix: user.lastNamePrefix,
    lastName: user.lastName,
    nbbNumber: user.nbbNumber,
    refereeLevel: user.refereeLevel,
    foysUserId: user.foysUserId,
    memberSince: user.memberSince?.toPlainDate().toString() ?? null,
    memberships: user.memberships.map((m) => ({
      membershipType: m.membershipType,
      primaryTeam: m.primaryTeam,
    })),
    coaches: user.coaches.map((c) => ({ team: c.team })),
  }));

  return NextResponse.json(data);
}