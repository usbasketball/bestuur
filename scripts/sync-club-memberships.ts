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
// 5. Upserts a membership per (user, season) into the club_memberships table
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
import { mapPlanMembershipType, toPlainDateTime, ClubMembershipType, TeamType } from "../lib/types";
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

  // Collapse multiple club plans per (user, season) into a single membership,
  // preferring a competition plan when present (e.g. a member who switched from
  // "Recreanten" to "Wedstrijdspelend" within the same season).
  for (const [key, plans] of perSeasonPlans) {
    const { user, season } = plans[0];
    const competition = choosePlan(plans.map((p) => p.plan));
    const chosen = competition.plan;
    const membershipType = competition.type;
    const cancelledAt = chosen.cancellationDate
      ? new Date(chosen.cancellationDate)
      : null;

    if (!membershipType) {
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `Would upsert: ${user.email || key} — ${season}, type: ${membershipType || "?"}${plans.length > 1 ? ` (${plans.length} plans)` : ""}, cancelled: ${cancelledAt ? cancelledAt.toISOString().slice(0, 10) : "no"}`
      );
      continue;
    }

    try {
      await upsertClubMembership(db, {
        userId: user.id,
        season,
        primaryTeam: null,
        registeredTeam: null,
        membershipType,
        cancelledAt: cancelledAt ? toPlainDateTime(cancelledAt) : null,
      });
      upserted++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error upserting club membership for ${user.email} (${season}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Club plans: ${clubPlansFound}, Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

if (isMainModule(import.meta.url)) {
  void main();
}
