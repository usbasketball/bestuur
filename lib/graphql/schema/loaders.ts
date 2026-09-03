import { db } from "@/lib/db";
import {
  SEASONS,
  type Season,
  type TeamType,
  type CommitteeType,
  type RefereeLevel,
} from "@/lib/types";
import type { UserRecord } from "./types/user";
import type { MemberRecord } from "./types/member";

/** Reject a season value that isn't a known season key; default to the latest. */
export function normalizeSeason(raw: unknown): Season {
  return SEASONS.includes(raw as string) ? (raw as Season) : SEASONS[0];
}

function toPlainDateString(value: unknown): string | null {
  if (value && typeof value === "object" && "toPlainDate" in value) {
    return (value as { toPlainDate: () => { toString(): string } }).toPlainDate().toString();
  }
  return null;
}

/** Map a full DB user row (with Temporal memberSince) to a UserRecord DTO. */
export function buildUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  refereeLevel: string | null;
  foysUserId: string | null;
  memberSince: unknown;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastNamePrefix: user.lastNamePrefix,
    lastName: user.lastName,
    nbbNumber: user.nbbNumber,
    refereeLevel: user.refereeLevel as RefereeLevel | null,
    foysUserId: user.foysUserId,
    memberSince: toPlainDateString(user.memberSince),
  };
}

export type MemberContext = {
  primaryTeamByUser: Map<string, TeamType>;
  coachingByUser: Map<string, TeamType[]>;
  committeesByUser: Map<string, CommitteeType[]>;
};

/** Batch-load per-season memberships/coach/committee context for all members at once. */
export async function loadMemberContext(season: Season): Promise<MemberContext> {
  const [memberships, coaches, committees] = await Promise.all([
    db.orm.public.ClubMembership.select("userId", "primaryTeam")
      .where((m) => m.season.eq(season))
      .all(),
    db.orm.public.Coach.select("userId", "team")
      .where((c) => c.season.eq(season))
      .all(),
    db.orm.public.Committee.select("userId", "type")
      .where((c) => c.season.eq(season))
      .all(),
  ]);

  const primaryTeamByUser = new Map<string, TeamType>();
  for (const m of memberships) {
    if (m.primaryTeam) primaryTeamByUser.set(m.userId, m.primaryTeam);
  }
  const coachingByUser = new Map<string, TeamType[]>();
  for (const c of coaches) {
    coachingByUser.set(c.userId, [...(coachingByUser.get(c.userId) ?? []), c.team]);
  }
  const committeesByUser = new Map<string, CommitteeType[]>();
  for (const c of committees) {
    committeesByUser.set(c.userId, [...(committeesByUser.get(c.userId) ?? []), c.type]);
  }

  return { primaryTeamByUser, coachingByUser, committeesByUser };
}

/** Batch-load users, optionally filtered by id. */
export async function loadUsers(userIds?: string[]): Promise<UserRecord[]> {
  const base = db.orm.public.User.select(
    "id",
    "email",
    "firstName",
    "lastNamePrefix",
    "lastName",
    "nbbNumber",
    "refereeLevel",
    "foysUserId",
    "memberSince",
  );

  const users =
    userIds && userIds.length > 0
      ? await base
          .where((u) => u.id.in([...userIds]))
          .orderBy([(u) => u.firstName.asc()])
          .all()
      : await base.orderBy([(u) => u.firstName.asc()]).all();

  return users.map(buildUser);
}

/** Compose a Member DTO from a UserRecord + season + member context. */
export function memberRecord(
  user: UserRecord,
  season: Season,
  ctx: MemberContext,
): MemberRecord {
  return {
    id: user.id,
    user,
    season,
    primaryTeam: ctx.primaryTeamByUser.get(user.id) ?? null,
    coachingTeams: ctx.coachingByUser.get(user.id) ?? [],
    committees: ctx.committeesByUser.get(user.id) ?? [],
  };
}

/** Load a single user by Auth0 subject (used by the `me` query). */
export async function loadUserByAuth0Sub(auth0Sub: string): Promise<UserRecord | null> {
  const user = await db.orm.public.User.select(
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
    .where((u) => u.auth0Sub.eq(auth0Sub))
    .first();

  return user ? buildUser(user) : null;
}
