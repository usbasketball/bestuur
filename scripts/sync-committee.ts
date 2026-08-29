#!/usr/bin/env node

// Sync committee members (the board) from FOYS for existing users.
//
// 1. Fetches committee-persons from the FOYS committee-persons endpoint for
//    the board committee (committeeId 2909, active=true), paginated
// 2. Records every active person under the current season (SEASONS[0])
// 3. Maps the person's role to a CommitteeType enum value (stripping emoji,
//    e.g. "Wedstrijdsecretaris 🚀" → BOARD_GAME_SECRETARY)
// 4. Resolves each person to a local user by foys_user_id
// 5. Creates a Committee row per (user, type, season) when missing
//
// Usage:
//   npm run sync:committee           # dry run (default)
//   npm run sync:committee -- --live # actually write to the database
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
import { SEASONS, type CommitteeType } from "../lib/types";
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

const FOYS_COMMITTEE_PERSONS_API =
  "https://api.foys.io/foys/api/v1/management/committee-persons";
const COMMITTEE_ID = 2909;
const PAGE_SIZE = 100;

// Active committee persons are recorded under the current season.
const CURRENT_SEASON = SEASONS[0];

interface FoysCommitteePerson {
  id: number;
  committeeId: number;
  personId: string | null;
  role: string | null;
  position: number | null;
  startDate: string | null;
  endDate: string | null;
}

interface FoysCommitteePersonsResponse {
  totalCount: number;
  items: FoysCommitteePerson[];
}

// Fetch all active persons of a committee via skipCount/maxResultCount.
export async function fetchCommitteePersons(committeeId: number): Promise<FoysCommitteePerson[]> {
  const all: FoysCommitteePerson[] = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_COMMITTEE_PERSONS_API);
    url.searchParams.set("committeeId", String(committeeId));
    url.searchParams.set("active", "true");
    url.searchParams.set("skipCount", String(skip));
    url.searchParams.set("maxResultCount", String(PAGE_SIZE));
    url.searchParams.set("sorting", "position asc");

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${FOYS_API_KEY}`,
        "X-Cluster": "cluster-default",
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Foys committee-persons API ${res.status}: ${body}`);
    }
    const data = (await res.json()) as FoysCommitteePersonsResponse;
    const items = Array.isArray(data.items) ? data.items : [];
    totalCount = data.totalCount ?? items.length;
    all.push(...items);
    skip += PAGE_SIZE;
  }

  return all;
}

// ── Role mapping ──────────────────────────────────────────────────────────────

// Map a FOYS committee role to a CommitteeType. Roles often carry decorations
// ("Wedstrijdsecretaris 🚀", "Penningmeester 🍷✨"), so strip everything that is
// not a letter/digit/space before matching. Returns null for unknown roles.
export function mapCommitteeType(role: string | null | undefined): CommitteeType | null {
  if (!role) return null;
  const normalized = role
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .toLowerCase();

  if (normalized.includes("wedstrijdsecretaris")) return "BOARD_GAME_SECRETARY";
  if (normalized.includes("voorzitter")) return "BOARD_CHAIRPERSON";
  if (normalized.includes("penningmeester")) return "BOARD_TREASURER";
  if (normalized.includes("secretaris")) return "BOARD_SECRETARY";
  if (normalized.includes("algemeen")) return "BOARD_GENERAL_MEMBER";
  if (normalized.includes("omni")) return "OMNI";
  return null;
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts", "committee");

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

interface DbCommittee {
  type: CommitteeType;
  season: string;
}

export async function queryCommittees(db: Db): Promise<DbCommittee[]> {
  return db.orm.public.Committee.select("type", "season").all();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });

  console.log(`Fetching committee persons for committee ${COMMITTEE_ID}...`);
  let persons: FoysCommitteePerson[];
  try {
    persons = await fetchCommitteePersons(COMMITTEE_ID);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error fetching committee persons: ${message}`);
    await pool.end();
    process.exitCode = 1;
    return;
  }
  console.log(`Fetched ${persons.length} committee persons.\n`);

  saveArtifact(`${COMMITTEE_ID}.json`, persons);

  const users = await queryUsers(db);
  const userIdByFoysId = new Map(
    users
      .filter((u) => u.foys_user_id != null)
      .map((u) => [u.foys_user_id as string, u.id]),
  );
  const existingKeys = new Set(
    (await queryCommittees(db)).map((c) => `${c.type}|${c.season}`),
  );

  let synced = 0;
  const skipped = 0;
  let errors = 0;
  let unknownRoles = 0;
  let noUser = 0;

  for (const person of persons) {
    const season = CURRENT_SEASON;
    const type = mapCommitteeType(person.role);
    if (!type) {
      console.warn(`  Unknown committee role "${person.role}" (${person.personId}) — skipped`);
      unknownRoles++;
      continue;
    }
    const userId = person.personId ? userIdByFoysId.get(person.personId) : undefined;
    if (!userId) {
      console.warn(`  Committee member ${person.personId} (${type}, ${season}) has no local user — skipped`);
      noUser++;
      continue;
    }
    const key = `${type}|${season}`;
    if (existingKeys.has(key)) {
      continue;
    }

    if (dryRun) {
      console.log(`Would sync committee: ${person.role} (${type}) → ${season}, member ${person.personId}`);
      synced++;
      continue;
    }

    try {
      await db.orm.public.Committee.create({ userId, type, season });
      existingKeys.add(key);
      synced++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error syncing committee ${type} (${season}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Synced: ${synced}, Skipped: ${skipped}, Unknown roles: ${unknownRoles}, No local user: ${noUser}, Errors: ${errors}`
  );
}

if (isMainModule(import.meta.url)) {
  void main();
}