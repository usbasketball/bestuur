#!/usr/bin/env node

// Sync teams from FOYS competition API.
//
// 1. Fetches all teams from the FOYS competition management API
// 2. Maps team names to TeamType enum values (strips hyphens: "MSE-2" → "MSE2")
// 3. Upserts each team into the local PostgreSQL competition_teams table
//
// Usage:
//   npm run sync:teams               # dry run (default)
//   npm run sync:teams -- --live     # actually write to the database
//
// Required env vars (in .env.local / .env):
//   DATABASE_URL   PostgreSQL connection string
//   FOYS_API_KEY   Foys bearer token

import { Pool, QueryResult } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { mapTeamType, TeamType, Discipline } from "../lib/types";

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

const FOYS_TEAMS_API = "https://api.foys.io/competition/management-api/v1/teams";
const PAGE_SIZE = 30;

interface FoysTeam {
  id: number;
  name: string | null;
  shortName: string | null;
  sponsorClubName: string | null;
  description: string | null;
  amountOfMembers: number;
  teamMemberStatus: string;
  teamReferenceId: string;
  organisationId: string;
  organisationName: string;
  isCurrentDateWithinSeason: boolean;
  season: { id: number; name: string } | null;
  disciplines: { id: number; name: string }[];
}

interface FoysTeamsResponse {
  totalCount: number;
  items: FoysTeam[];
}

async function fetchAllFoysTeams(): Promise<FoysTeamsResponse> {
  const allTeams = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_TEAMS_API);
    url.searchParams.set("skipCount", String(skip));
    url.searchParams.set("maxResultCount", String(PAGE_SIZE));

    const res = await fetch(url, {
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

    const data: FoysTeamsResponse = await res.json();
    totalCount = data.totalCount;
    allTeams.push(...data.items);
    skip += PAGE_SIZE;
    console.log(`  Fetched ${allTeams.length}/${totalCount} teams...`);
  }

  return { totalCount, items: allTeams };
}

// ── Database ──────────────────────────────────────────────────────────────────

interface UpsertTeamParams {
  foysTeamId: number;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
}

async function upsertTeam(pool: Pool, { foysTeamId, name, season, teamType, discipline }: UpsertTeamParams): Promise<QueryResult> {
  const query = `
    INSERT INTO competition_teams (id, foys_team_id, name, season, team_type, discipline, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, now(), now())
    ON CONFLICT (foys_team_id) DO UPDATE SET
      name = EXCLUDED.name,
      season = EXCLUDED.season,
      team_type = EXCLUDED.team_type,
      discipline = EXCLUDED.discipline,
      updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `;
  return pool.query(query, [foysTeamId, name, season, teamType, discipline]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  // 1. Fetch FOYS teams
  console.log("Fetching teams from FOYS API...");
  const { items } = await fetchAllFoysTeams();
  console.log(`Fetched ${items.length} teams from FOYS.\n`);

  // 2. Connect to database
  const pool = new Pool({ connectionString: DATABASE_URL });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const team of items) {
    const season = team.season?.name || null;
    const teamType = mapTeamType(team.name, team.disciplines);
    const sanitizedName = (team.name || "").replace(/[-*\s]/g, "").trim();

    if (!teamType) {
      console.warn(`Skipping team with unmapped type: "${sanitizedName}" (id: ${team.id})`);
      skipped++;
      continue;
    }

    if (!season) {
      console.warn(`Skipping team without season: ${sanitizedName} (id: ${team.id})`);
      skipped++;
      continue;
    }

    const is3x3 = teamType === "V3x3";
    const discipline: Discipline = is3x3 ? "DISCIPLINE_3x3" : "DISCIPLINE_5x5";

    if (dryRun) {
      console.log(`Would upsert: ${sanitizedName} — season: ${season}, type: ${teamType}, discipline: ${discipline}, foysId: ${team.id}`);
      continue;
    }

    try {
      const result = await upsertTeam(pool, {
        foysTeamId: team.id,
        name: team.name,
        season,
        teamType,
        discipline,
      });
      const inserted = result.rows[0]?.inserted;
      if (inserted) {
        console.log(`Created: ${sanitizedName} (${season}, ${teamType})`);
        created++;
      } else {
        console.log(`Updated: ${sanitizedName} (${season}, ${teamType})`);
        updated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error for ${sanitizedName} (${season}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

main();
