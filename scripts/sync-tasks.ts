#!/usr/bin/env node

// Sync task assignments from FOYS match officials.
//
// 1. Queries competition matches (competition_id set) from the local database
// 2. For each match, fetches the assigned officials (referee, table, shot clock
//    and hall duty) from the FOYS match-officials endpoint
// 3. Replaces the match's previous roster and creates one Task per mapped
//    official and one TaskAssignment for each of them
// 4. Officials who match a local user (by NBB number or email) link to that
//    user; external officials are recorded with their NBB number and no user.
//    No placeholder users are created.
//
// Usage:
//   npm run sync:tasks              # dry run (default)
//   npm run sync:tasks -- --live    # actually write to the database
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
import type { TaskType } from "../lib/types";
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

const FOYS_MATCH_OFFICIALS_API = (matchId: number) =>
  `https://api.foys.io/competition/management-api/v1/matches/${matchId}/match-officials?skipCount=0&maxResultCount=30&matcheId=${matchId}`;

interface FoysOfficial {
  id: number;
  officialRoleName: string | null;
  person: {
    id: string;
    fullName: string | null;
    federationMembershipIdentifier: string | null;
    email: string | null;
  } | null;
  [key: string]: unknown;
}

interface FoysOfficialsResponse {
  totalCount: number;
  items: FoysOfficial[];
}

export async function fetchOfficials(matchId: number): Promise<FoysOfficial[]> {
  const res = await fetch(FOYS_MATCH_OFFICIALS_API(matchId), {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${FOYS_API_KEY}`,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Foys match officials API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as FoysOfficialsResponse;
  return Array.isArray(data.items) ? data.items : [];
}

// Map a FOYS official role to a TaskType. Roles that do not map to a confirmed
// task (e.g. unknown table/hall variants) return null and are skipped.
export function mapRoleToTaskType(role: string | null | undefined): TaskType | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r.includes("hall")) return "HALL_DUTY";
  if (r.includes("referee")) return "REFEREE";
  if (r.includes("scorekeeper")) return "TABLE_SCORER";
  if (r.includes("scorer")) return "TABLE_SCORER";
  if (r.includes("timer")) return "TABLE_TIMER";
  if (r.includes("shot")) return "TABLE_24S_SHOT_CLOCK";
  return null;
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts", "tasks");

function saveArtifact(filename: string, data: unknown): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved artifact: ${filePath}`);
}

// ── Database ──────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof postgres<Contract>>;

interface MatchRow {
  id: string;
  foysMatchId: number;
}

export async function queryCompetitionMatches(db: Db): Promise<MatchRow[]> {
  return db.orm.public.Match.select("id", "foysMatchId")
    .where((m) => m.competitionId.isNotNull())
    .all();
}

// Find the local user for a FOYS official, preferring the NBB number and
// falling back to the email. Returns null for external users.
export async function findUserByOfficial(db: Db, official: FoysOfficial): Promise<string | null> {
  const nbbNumber = official.person?.federationMembershipIdentifier ?? null;
  if (nbbNumber) {
    const byNbb = await db.orm.public.User.where((u) => u.nbbNumber.eq(nbbNumber)).first();
    if (byNbb) return byNbb.id;
  }
  const email = official.person?.email ?? null;
  if (email) {
    const byEmail = await db.orm.public.User.where((u) => u.email.eq(email)).first();
    if (byEmail) return byEmail.id;
  }
  return null;
}

// Remove the previous roster for a match. Assignments go first to satisfy the
// task_assignments foreign key, then the tasks themselves.
export async function deleteMatchRoster(db: Db, matchId: string): Promise<void> {
  const tasks = await db.orm.public.Task.select("id").where((t) => t.matchId.eq(matchId)).all();
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length === 0) return;
  await db.orm.public.TaskAssignment.where((ta) => ta.taskId.in(taskIds)).deleteAndCount();
  await db.orm.public.Task.where((t) => t.matchId.eq(matchId)).deleteAndCount();
}

export async function createTask(db: Db, p: { matchId: string; taskType: TaskType }): Promise<string> {
  const task = await db.orm.public.Task.create({ matchId: p.matchId, taskType: p.taskType });
  return task.id;
}

// Record an assignment for a task: by local user when linked, otherwise by the
// external official's NBB number.
export async function createAssignment(
  db: Db,
  p: { taskId: string; userId: string | null; nbbNumber: string | null },
): Promise<void> {
  await db.orm.public.TaskAssignment.create({
    taskId: p.taskId,
    userId: p.userId,
    nbbNumber: p.nbbNumber,
    isDouble: false,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });

  let matches: MatchRow[] = [];
  try {
    matches = await queryCompetitionMatches(db);
    console.log(`Found ${matches.length} competition matches.\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error querying matches: ${message}`);
    await pool.end();
    return;
  }

  let assignmentsCreated = 0;
  let externalAssignments = 0;
  let errors = 0;

  for (const match of matches) {
    const foysMatchId = Number(match.foysMatchId);
    if (Number.isNaN(foysMatchId)) continue;

    let officials: FoysOfficial[];
    try {
      officials = await fetchOfficials(foysMatchId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error fetching officials for match ${match.id}: ${message}`);
      errors++;
      continue;
    }

    saveArtifact(`match-${match.id}-officials.json`, officials);

    if (!dryRun) {
      try {
        await deleteMatchRoster(db, match.id);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error clearing previous roster for match ${match.id}: ${message}`);
        errors++;
        continue;
      }
    }

    for (const official of officials) {
      const taskType = mapRoleToTaskType(official.officialRoleName);
      if (!taskType) continue;

      const userId = await findUserByOfficial(db, official);
      const external = userId === null;
      const assignee = external ? (official.person?.fullName ?? official.id) : userId;

      if (dryRun) {
        console.log(
          external
            ? `  Would assign external official ${assignee} → ${taskType} for match ${match.id}`
            : `  Would assign ${assignee} → ${taskType} for match ${match.id}`,
        );
        continue;
      }

      try {
        const taskId = await createTask(db, { matchId: match.id, taskType });
        await createAssignment(db, {
          taskId,
          userId,
          nbbNumber: official.person?.federationMembershipIdentifier ?? null,
        });
        assignmentsCreated++;
        if (external) externalAssignments++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error creating ${taskType} assignment for official ${official.id} (match ${match.id}): ${message}`);
        errors++;
      }
    }
  }

  await pool.end();

  console.log(
    `\nDone. Matches: ${matches.length}, assignments created: ${assignmentsCreated} (${externalAssignments} external), errors: ${errors}`,
  );
}

if (isMainModule(import.meta.url)) {
  void main();
}