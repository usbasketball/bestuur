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

import { Pool, QueryResult } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { mapPlanMembershipType, ClubMembershipType, TeamType } from "../lib/types";

const dryRun = !process.argv.includes("--live");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const FOYS_API_KEY = process.env.FOYS_API_KEY;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

if (!FOYS_API_KEY) {
  console.error("Missing FOYS_API_KEY env var.");
  process.exit(1);
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

async function fetchPlanAssignments(foysUserId: string): Promise<FoysPlanAssignment[]> {
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
function seasonFromEndDate(endDate: string | null | undefined): string | null {
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

interface DbUser {
  id: string;
  foys_user_id: string | null;
  email: string | null;
}

async function queryUsers(pool: Pool): Promise<DbUser[]> {
  const result = await pool.query(
    "SELECT id, foys_user_id, email FROM users WHERE foys_user_id IS NOT NULL ORDER BY email"
  );
  return result.rows;
}

interface UpsertClubMembershipParams {
  userId: string;
  season: string;
  primaryTeam: TeamType | null;
  registeredTeam: TeamType | null;
  membershipType: ClubMembershipType | null;
  cancelledAt: Date | null;
}

async function upsertClubMembership(pool: Pool, p: UpsertClubMembershipParams): Promise<QueryResult> {
  const query = `
    INSERT INTO club_memberships (
      id, user_id, season, primary_team, registered_team, membership_type, cancelled_at,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, now(), now()
    )
    ON CONFLICT (user_id, season) DO UPDATE SET
      primary_team = EXCLUDED.primary_team,
      registered_team = EXCLUDED.registered_team,
      membership_type = EXCLUDED.membership_type,
      cancelled_at = EXCLUDED.cancelled_at,
      updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `;
  return pool.query(query, [
    p.userId,
    p.season,
    p.primaryTeam,
    p.registeredTeam,
    p.membershipType,
    p.cancelledAt,
  ]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  // 1. Query users from database
  const pool = new Pool({ connectionString: DATABASE_URL });
  const users = await queryUsers(pool);
  console.log(`Found ${users.length} users with foys_user_id.\n`);

  if (users.length === 0) {
    console.log("No users to process. Run sync:users first if needed.");
    await pool.end();
    return;
  }

  let created = 0;
  let updated = 0;
  const skipped = 0;
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
    const scored = plans.map((p) => {
      const planName = p.plan.plan?.name ?? p.plan.planName;
      const isMatchLicense = p.plan.plan?.isMatchLicense ?? null;
      return { plan: p, type: mapPlanMembershipType(planName, isMatchLicense) };
    });
    const competition =
      scored.find((s) => s.type === "COMPETITION") ??
      scored.find((s) => s.type === "RECREATIONAL") ??
      scored[0];
    const chosen = competition.plan;
    const membershipType = competition.type;
    const cancelledAt = chosen.plan.cancellationDate
      ? new Date(chosen.plan.cancellationDate)
      : null;

    if (dryRun) {
      console.log(
        `Would upsert: ${user.email || key} — ${season}, type: ${membershipType || "?"}${plans.length > 1 ? ` (${plans.length} plans)` : ""}, cancelled: ${cancelledAt ? cancelledAt.toISOString().slice(0, 10) : "no"}`
      );
      continue;
    }

    try {
      const result = await upsertClubMembership(pool, {
        userId: user.id,
        season,
        primaryTeam: null,
        registeredTeam: null,
        membershipType,
        cancelledAt,
      });
      const inserted = result.rows[0]?.inserted;
      if (inserted) {
        created++;
      } else {
        updated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error upserting club membership for ${user.email} (${season}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Club plans: ${clubPlansFound}, Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

main();
