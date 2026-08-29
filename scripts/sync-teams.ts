#!/usr/bin/env node

// Sync teams from FOYS competition API.
//
// 1. Fetches all teams from the FOYS competition management API
// 2. Maps team names to TeamType enum values (strips hyphens: "MSE-2" → "MSE2")
// 3. Upserts each team into the local PostgreSQL teams table (foys_competition_team_id)
// 4. Fetches the (non-competition) general teams API and writes their general
//    FOYS id into foys_team_id on the matching team row (D1→VSE1, H1→MSE1, ...)
//
// Usage:
//   npm run sync:teams               # dry run (default)
//   npm run sync:teams -- --live     # actually write to the database
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
import { mapTeamType, TEAM_TYPES, TeamType, Discipline } from "../lib/types";
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

const FOYS_TEAMS_API = "https://api.foys.io/competition/management-api/v1/teams";
const FOYS_GENERAL_TEAMS_API = "https://api.foys.io/foys/api/v1/management/teams";
const FOYS_GENERAL_SEASON_ID = "2792";
const PAGE_SIZE = 30;

interface FoysCompetitionTeam {
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

interface FoysCompetitionTeamsResponse {
  totalCount: number;
  items: FoysCompetitionTeam[];
}

export async function fetchAllFoysTeams(): Promise<FoysCompetitionTeamsResponse> {
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

    const data: FoysCompetitionTeamsResponse = await res.json();
    totalCount = data.totalCount;
    allTeams.push(...data.items);
    skip += PAGE_SIZE;
    console.log(`  Fetched ${allTeams.length}/${totalCount} teams...`);
  }

  return { totalCount, items: allTeams };
}

interface FoysGeneralTeam {
  id: number;
  guid: string;
  name: string | null;
  shortName: string | null;
  organisationName: string | null;
  organisationId: string | null;
  isCompetitionTeam: boolean;
  season: { id: number; name: string } | null;
  teamCategory: string | null;
  teamLicenseType: string | null;
  disciplineName: string | null;
}

interface FoysGeneralTeamsResponse {
  totalCount: number;
  items: FoysGeneralTeam[];
}

export async function fetchAllFoysGeneralTeams(): Promise<FoysGeneralTeamsResponse> {
  const allTeams = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_GENERAL_TEAMS_API);
    url.searchParams.set("seasonId", FOYS_GENERAL_SEASON_ID);
    url.searchParams.set("skipCount", String(skip));
    url.searchParams.set("maxResultCount", String(PAGE_SIZE));
    url.searchParams.set("sorting", "name");
    url.searchParams.set("isCompetitionTeam", "false");

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${FOYS_API_KEY}`,
        "X-Cluster": "cluster-default",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Foys general API ${res.status}: ${body}`);
    }

    const data: FoysGeneralTeamsResponse = await res.json();
    totalCount = data.totalCount;
    allTeams.push(...data.items);
    skip += PAGE_SIZE;
    console.log(`  Fetched ${allTeams.length}/${totalCount} general teams...`);
  }

  return { totalCount, items: allTeams };
}

// Map a non-competition team name to a TeamType. General teams use Dutch
// prefixes: "D1" (Dames, women) → VSE1, "H1" (Heren, men) → MSE1. Teams without
// a usable team type (e.g. "Vrijtrainen") return null and are skipped.
export function mapGeneralTeamType(name: string | null | undefined): TeamType | null {
  if (!name) return null;
  if (name == "3x3") return "V3x3";
  const m = /^([DH])(\d+)$/.exec(name.trim());
  if (!m) return null;
  const prefix = m[1];
  const number = m[2];
  const base = prefix === "D" ? "VSE" : "MSE";
  const type = `${base}${number}` as TeamType;
  return (TEAM_TYPES as readonly string[]).includes(type) ? type : null;
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts");

function saveArtifact(filename: string, data: unknown): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved artifact: ${filePath}`);
}

// ── Database ──────────────────────────────────────────────────────────────────

interface UpsertTeamParams {
  foysCompetitionTeamId: number;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
}

export async function upsertTeam(db: ReturnType<typeof postgres<Contract>>, { foysCompetitionTeamId, name, season, teamType, discipline }: UpsertTeamParams): Promise<void> {
  await db.orm.public.Team.upsert({
    create: { foysCompetitionTeamId, name, season, teamType, discipline },
    update: { name, season, teamType, discipline },
    conflictOn: { foysCompetitionTeamId },
  });
}

// Link the general FOYS team id (foys_team_id) onto an existing team row,
// matched by (team_type, season). Rows are only created by the competition
// sync above, so a missing row returns false and is skipped rather than
// inserted without a foys_competition_team_id.
export async function upsertGeneralTeamId(db: ReturnType<typeof postgres<Contract>>, p: { foysTeamId: number; season: string; teamType: TeamType; name: string | null }): Promise<boolean> {
  const existing = await db.orm.public.Team
    .where({ teamType: p.teamType, season: p.season })
    .first();
  if (!existing) return false;

  await db.orm.public.Team
    .where({ id: existing.id })
    .update({ foysTeamId: p.foysTeamId, name: p.name ?? existing.name });
  return true;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  // 1. Fetch FOYS teams
  console.log("Fetching teams from FOYS API...");
  const { items } = await fetchAllFoysTeams();
  console.log(`Fetched ${items.length} teams from FOYS.\n`);

  saveArtifact("teams.json", items);

  // 2. Connect to database
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });

  let upserted = 0;
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
      console.log(`Would upsert: ${sanitizedName} — season: ${season}, type: ${teamType}, discipline: ${discipline}, foysCompetitionTeamId: ${team.id}`);
      continue;
    }

    try {
      await upsertTeam(db, {
        foysCompetitionTeamId: team.id,
        name: team.name,
        season,
        teamType,
        discipline,
      });
      console.log(`Upserted: ${sanitizedName} (${season}, ${teamType})`);
      upserted++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error for ${sanitizedName} (${season}): ${message}`);
      errors++;
    }
  }

  // 2. Sync general (non-competition) FOYS team ids into foys_team_id
  console.log("\nFetching general teams from FOYS API (isCompetitionTeam=false)...");
  const general = await fetchAllFoysGeneralTeams();
  console.log(`Fetched ${general.items.length} general teams.\n`);

  saveArtifact("teams-general.json", general.items);

  let generalTotal = 0;

  for (const team of general.items) {
    const season = team.season?.name || null;
    const teamType = mapGeneralTeamType(team.name);
    const sanitizedName = (team.name || "?").trim();

    if (!season) {
      console.log(`Skipping general team without season: ${sanitizedName} (id: ${team.id})`);
      continue;
    }
    if (!teamType) {
      console.log(`Skipping general team with unmapped type: "${sanitizedName}" (id: ${team.id})`);
      continue;
    }

    generalTotal++;

    if (dryRun) {
      console.log(`Would set foysTeamId=${team.id} on ${teamType} (${season})`);
      continue;
    }

    try {
      const linked = await upsertGeneralTeamId(db, {
        foysTeamId: team.id,
        name: team.name,
        season,
        teamType,
      });
      if (linked) {
        console.log(`Linked foysTeamId=${team.id} → ${teamType} (${season})`);
      } else {
        console.log(`No competition row for general team: ${sanitizedName} (${season}, ${teamType}) — skipped`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error for general team ${sanitizedName} (${season}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`
  );
  console.log(`General teams synced: ${generalTotal}`);
}

if (isMainModule(import.meta.url)) {
  void main();
}
