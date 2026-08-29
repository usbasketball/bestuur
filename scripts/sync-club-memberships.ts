#!/usr/bin/env node

// Sync club memberships from FOYS for existing users.
//
// 1. Queries users from the local database that have a foys_user_id
// 2. For each user, fetches their FOYS plan assignments from the
//    plan-assignments endpoint
// 3. Only keeps the club's own membership plans (plan.tenantType === "Club"),
//    e.g. "Wedstrijdspelend 1x/2x trainen", "Recreanten", "3x3 lid". Federation
//    NBB match-license plans ("Wedstrijd spelend lid", "Recreant lid", ...) are
//    excluded.
// 4. Derives the season from the plan start/end dates
// 5. Also fetches each general team's active members (from the local teams
//    table, identified by foys_team_id) and derives each member's primary_team
//    per season from the team members endpoint. First team wins when a member
//    appears in multiple teams in the same season.
// 6. Upserts a membership per (user, season) into the club_memberships table
//
// Usage:
//   npm run sync:club-memberships           # dry run (default)
//   npm run sync:club-memberships -- --live # actually write to the database
//
// Required env vars (in .env.local / .env):
//   DATABASE_URL   PostgreSQL connection string
//   FOYS_API_KEY   Foys bearer token

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { Pool } from "pg";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract.d";
import contractJson from "../prisma/contract.json";
import { mapPlanMembershipType, toPlainDateTime, ClubMembershipType, TeamType, TEAM_TYPES } from "../lib/types";
import { isMainModule } from "../lib/is-main";

const dryRun = !process.argv.includes("--live");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const FOYS_API_KEY = process.env.FOYS_API_KEY;

function validateEnv(): void {
  if (!DATABASE_URL) {
    console.error("Missing DATABASE_URL env var.");
    process.exit(1);
  }

  if (!FOYS_API_KEY) {
    console.error("Missing FOYS_API_KEY env var.");
    process.exit(1);
  }
}

// ── FOYS API ──────────────────────────────────────────────────────────────────

const FOYS_PLAN_ASSIGNMENTS_API =
  "https://api.foys.io/foys/api/v1/management/plan-assignments/person";

interface FoysPlanAssignment {
  startDate: string | null;
  endDate: string | null;
  planName: string | null;
  cancellationDate: string | null;
  plan: {
    tenantType: string | null;
    isMatchLicense: boolean | null;
    name: string | null;
  } | null;
  [key: string]: unknown;
}

export async function fetchPlanAssignments(foysUserId: string): Promise<FoysPlanAssignment[]> {
  const res = await fetch(`${FOYS_PLAN_ASSIGNMENTS_API}/${foysUserId}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${FOYS_API_KEY}`,
      "X-Cluster": "cluster-default",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Foys API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as FoysPlanAssignment[] | null;
  return Array.isArray(data) ? data : [];
}

const FOYS_TEAM_MEMBERS_API = (teamId: number) =>
  `https://api.foys.io/foys/api/v1/management/teams/${teamId}/members`;
const TEAM_MEMBERS_PAGE_SIZE = 30;

interface FoysTeamMembersResponse {
  totalCount: number;
  items: FoysTeamMember[];
}

interface FoysTeamMember {
  id: number;
  personId: string | null;
  teamId: number;
  teamName: string | null;
  start: string | null;
  end: string | null;
  teamRole?: {
    isPlayer?: boolean | null;
    code?: string | null;
    name?: string | null;
  } | null;
}

// Fetch all active members of a single FOYS team (general, non-competition
// teams addressable via the club management API). The endpoint paginates via
// skipCount/maxResultCount.
export async function fetchTeamMembers(teamId: number): Promise<FoysTeamMember[]> {
  const all: FoysTeamMember[] = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_TEAM_MEMBERS_API(teamId));
    url.searchParams.set("teamId", String(teamId));
    url.searchParams.set("skipCount", String(skip));
    url.searchParams.set("maxResultCount", String(TEAM_MEMBERS_PAGE_SIZE));
    url.searchParams.set("sorting", "Person.LastName asc");
    url.searchParams.set("activeMembers", "true");

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${FOYS_API_KEY}`,
        "X-Cluster": "cluster-default",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Foys team members API ${res.status}: ${body}`);
    }
    const data = (await res.json()) as FoysTeamMembersResponse;
    const items = Array.isArray(data.items) ? data.items : [];
    totalCount = data.totalCount ?? items.length;
    all.push(...items);
    skip += TEAM_MEMBERS_PAGE_SIZE;
  }

  return all;
}

// Derive the basketball season key from a plan assignment's end date. Seasons
// run across a year boundary and end in summer (e.g. 2026-07-31 or 2026-06-30
// belong to the 2025-2026 season, 2027-07-31 belongs to 2026-2027). Using the
// end date as the anchor handles mid-season joins where the start date is in a
// different year. Returns null when the end date is unusable.
export function seasonFromEndDate(endDate: string | null | undefined): string | null {
  if (!endDate || !/^\d{4}-\d{2}/.test(endDate)) return null;
  const year = Number(endDate.slice(0, 4));
  const month = Number(endDate.slice(5, 7));
  // Season ends in Jan–Jul → "year-1-year"; Aug–Dec → "year-year+1".
  const startYear = month >= 1 && month <= 7 ? year - 1 : year;
  return `${startYear}-${startYear + 1}`;
}

// Derive the season from a member/plan date range. Team roster entries for
// active members have no end date (end is null, e.g. "2026-08-01" start with an
// open end), so fall back to the start date. Both boundaries share the same
// month-based season rule.
export function seasonFromDates(startDate: string | null | undefined, endDate: string | null | undefined): string | null {
  return seasonFromEndDate(endDate) ?? seasonFromEndDate(startDate);
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts", "club-memberships");

function saveArtifact(filename: string, data: unknown): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved artifact: ${filePath}`);
}

// ── Database ──────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof postgres<Contract>>;

interface DbUser {
  id: string;
  foys_user_id: string | null;
  email: string | null;
}

export async function queryUsers(db: Db): Promise<DbUser[]> {
  const rows = await db.orm.public.User.select("id", "foysUserId", "email")
    .where((u) => u.foysUserId.isNotNull())
    .all();
  return rows.map((u) => ({
    id: u.id,
    foys_user_id: u.foysUserId,
    email: u.email,
  }));
}

interface DbTeam {
  foysTeamId: number;
  teamType: TeamType;
  season: string;
  name: string | null;
}

// The general (non-competition) teams that carry a foys_team_id (D1..H6, 3x3)
// are the teams whose active members we read to derive primary_team.
export async function queryTeamsWithFoysId(db: Db): Promise<DbTeam[]> {
  const rows = await db.orm.public.Team.select("foysTeamId", "teamType", "season", "name")
    .where((t) => t.foysTeamId.isNotNull())
    .all();
  return rows.flatMap((t) =>
    t.foysTeamId == null
      ? []
      : [{
          foysTeamId: t.foysTeamId,
          teamType: t.teamType,
          season: t.season,
          name: t.name,
        }],
  );
}

interface UpsertClubMembershipParams {
  userId: string;
  season: string;
  primaryTeam: TeamType | null;
  registeredTeam: TeamType | null;
  membershipType: ClubMembershipType;
  cancelledAt: Temporal.PlainDateTime | null;
}

export async function upsertClubMembership(db: Db, p: UpsertClubMembershipParams): Promise<void> {
  const update: Record<string, unknown> = {};
  if (p.primaryTeam != null) update.primaryTeam = p.primaryTeam;
  if (p.registeredTeam != null) update.registeredTeam = p.registeredTeam;
  if (p.membershipType != null) update.membershipType = p.membershipType;
  if (p.cancelledAt != null) update.cancelledAt = p.cancelledAt;

  await db.orm.public.ClubMembership.upsert({
    create: {
      userId: p.userId,
      season: p.season,
      primaryTeam: p.primaryTeam,
      registeredTeam: p.registeredTeam,
      membershipType: p.membershipType,
      cancelledAt: p.cancelledAt,
    },
    update,
    conflictOn: { userId: p.userId, season: p.season },
  });
}

// ── primary_team (team members) ───────────────────────────────────────────────

// Build a map of `${personId}|${season}` → TeamType from per-team member lists.
// The season is derived from each member's end date, falling back to the start
// date when the roster entry is open-ended (active members). When a person
// appears in multiple teams within the same season, the first one wins
// (iteration order, i.e. ascending foysTeamId for determinism) — secondary teams
// are ignored. Tolerates null/unknown team types by skipping them.
export function buildPrimaryTeamMap(
  teams: { foysTeamId: number; teamType: TeamType; season: string; name: string | null }[],
  membersByTeam: Map<number, FoysTeamMember[]>,
): Map<string, TeamType> {
  const primaryTeamMap = new Map<string, TeamType>();
  const order = new Map(TEAM_TYPES.map((t, i) => [t, i]));
  const sortedTeams = [...teams].sort(
    (a, b) => (order.get(a.teamType) ?? Infinity) - (order.get(b.teamType) ?? Infinity),
  );

  for (const team of sortedTeams) {
    const members = membersByTeam.get(team.foysTeamId) ?? [];
    for (const member of members) {
      if (!member.personId) continue;
      const season = seasonFromDates(member.start, member.end);
      if (!season) continue;
      const key = `${member.personId}|${season}`;
      if (!primaryTeamMap.has(key)) {
        primaryTeamMap.set(key, team.teamType);
      }
    }
  }

  return primaryTeamMap;
}

// ── Plan selection ────────────────────────────────────────────────────────────

// Choose the single representative plan for a (user, season): prefer a
// COMPETITION plan, then RECREATIONAL, then fall back to the first plan.
// Returns the chosen plan plus its mapped membership type (null when unknown).
export function choosePlan(
  plans: FoysPlanAssignment[],
): { plan: FoysPlanAssignment; type: ClubMembershipType | null } {
  const scored = plans.map((p) => {
    const planName = p.plan?.name ?? p.planName;
    const isMatchLicense = p.plan?.isMatchLicense ?? null;
    return { plan: p, type: mapPlanMembershipType(planName, isMatchLicense) };
  });
  return (
    scored.find((s) => s.type === "COMPETITION") ??
    scored.find((s) => s.type === "RECREATIONAL") ??
    scored[0]
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  // 1. Query users from database
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });
  const users = await queryUsers(db);
  console.log(`Found ${users.length} users with foys_user_id.\n`);

  if (users.length === 0) {
    console.log("No users to process. Run sync:users first if needed.");
    await pool.end();
    return;
  }

  let upserted = 0;
  let skipped = 0;
  let errors = 0;
  let clubPlansFound = 0;
  const perSeasonPlans = new Map<string, { user: DbUser; season: string; plan: FoysPlanAssignment }[]>();

  for (const user of users) {
    const label = user.email || user.foys_user_id || "?";
    console.log(`Fetching plan assignments for ${label}...`);

    let assignments: FoysPlanAssignment[];
    try {
      assignments = await fetchPlanAssignments(user.foys_user_id!);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error fetching plan assignments for ${label}: ${message}`);
      errors++;
      continue;
    }

    saveArtifact(`${user.foys_user_id}.json`, assignments);

    if (assignments.length === 0) {
      console.log(`  No plan assignments for ${label}`);
      continue;
    }

    // Keep only the club's own membership plans (not federation NBB
    // match-license plans like "Wedstrijd spelend lid", "Recreant lid").
    const clubPlans = assignments.filter(
      (a) => a.plan?.tenantType === "Club" && (a.plan?.isMatchLicense ?? true) === false
    );
    if (clubPlans.length === 0) {
      console.log(`  No club membership plans for ${label}`);
      continue;
    }

    for (const assignment of clubPlans) {
      const season = seasonFromEndDate(assignment.endDate);
      if (!season) {
        // Entries without usable dates are ignored.
        continue;
      }
      clubPlansFound++;
      const key = `${user.foys_user_id}|${season}`;
      const list = perSeasonPlans.get(key) ?? [];
      list.push({ user, season, plan: assignment });
      perSeasonPlans.set(key, list);
    }
  }

  // 2. Fetch each general team's active members to derive primary_team. Teams
  //    come from the local teams table (foys_team_id set by sync:teams); each
  //    team's stored teamType maps that team's foysTeamId to a TeamType.
  console.log("\nFetching team members from FOYS API...");
  let teams: DbTeam[] = [];
  try {
    teams = await queryTeamsWithFoysId(db);
    console.log(`Found ${teams.length} general teams with a foys_team_id.\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error querying teams: ${message}`);
    errors++;
  }

  const membersByTeam = new Map<number, FoysTeamMember[]>();
  let teamErrors = 0;
  for (const team of teams) {
    try {
      const members = await fetchTeamMembers(team.foysTeamId);
      saveArtifact(`${team.foysTeamId}.members.json`, members);
      membersByTeam.set(team.foysTeamId, members);
      console.log(
        `  ${team.name || team.foysTeamId} (${team.teamType}): ${members.length} members`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error fetching members for team ${team.foysTeamId}: ${message}`);
      teamErrors++;
    }
  }

  const primaryTeamByUserSeason = buildPrimaryTeamMap(teams, membersByTeam);

  // The set of (person, season) keys represented by club membership plan data.
  // Team members that fall outside this set have no membership row to attach to
  // and are reported rather than silently dropped.
  const membershipKeys = new Set<string>();
  for (const key of perSeasonPlans.keys()) {
    membershipKeys.add(key);
  }

  // Collapse multiple club plans per (user, season) into a single membership,
  // preferring a competition plan when present (e.g. a member who switched from
  // "Recreanten" to "Wedstrijdspelend" within the same season).
  let primaryTeamsSet = 0;
  for (const [key, plans] of perSeasonPlans) {
    const { user, season } = plans[0];
    const competition = choosePlan(plans.map((p) => p.plan));
    const chosen = competition.plan;
    const membershipType = competition.type;
    const cancelledAt = chosen.cancellationDate
      ? new Date(chosen.cancellationDate)
      : null;
    const primaryTeam = primaryTeamByUserSeason.get(`${user.foys_user_id}|${season}`) ?? null;

    if (!membershipType) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `Would upsert: ${user.email || key} — ${season}, type: ${membershipType || "?"}, primaryTeam: ${primaryTeam || "—"}${plans.length > 1 ? ` (${plans.length} plans)` : ""}, cancelled: ${cancelledAt ? cancelledAt.toISOString().slice(0, 10) : "no"}`
      );
      if (primaryTeam) primaryTeamsSet++;
      continue;
    }

    try {
      await upsertClubMembership(db, {
        userId: user.id,
        season,
        primaryTeam,
        registeredTeam: null,
        membershipType,
        cancelledAt: cancelledAt ? toPlainDateTime(cancelledAt) : null,
      });
      if (primaryTeam) primaryTeamsSet++;
      upserted++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error upserting club membership for ${user.email} (${season}): ${message}`);
      errors++;
    }
  }

  // Report team members who have no corresponding club membership row.
  let unmappedMemberships = 0;
  for (const [key, teamType] of primaryTeamByUserSeason) {
    if (!membershipKeys.has(key)) {
      const [personId, season] = key.split("|");
      console.warn(`  Team member ${personId} (${teamType}, ${season}) has no club membership row — skipped`);
      unmappedMemberships++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Club plans: ${clubPlansFound}, Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`
  );
  console.log(
    `Team members: ${teams.length} teams, ${teamErrors} fetch errors, primary_team set: ${primaryTeamsSet}, no-membership warnings: ${unmappedMemberships}`
  );
}

if (isMainModule(import.meta.url)) {
  void main();
}
