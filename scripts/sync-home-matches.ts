#!/usr/bin/env node

// Sync home matches from FOYS competition API.
//
// 1. Queries teams from the local database
// 2. For each team, fetches matches from the FOYS API
// 3. Filters for US home games only (homeOrganisation.id matches)
// 4. Upserts each match into the local PostgreSQL matches table
//
// Usage:
//   npm run sync:matches                                # dry run (default)
//   npm run sync:matches -- --live                      # actually write to the database
//   npm run sync:matches -- --season 2025-2026          # filter by season
//   npm run sync:matches -- --team MSE1                 # filter by team type
//   npm run sync:matches -- --live --season 2025-2026   # combined
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
import { mapFieldType, mapMatchStatus } from "../lib/types";
import { isMainModule } from "../lib/is-main";

const dryRun = !process.argv.includes("--live");
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}
const filterSeason = getArg("--season");
const filterTeam = getArg("--team");

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

const US_ORGANISATION_ID = "2f1e5e8e-e2c5-4d8b-9d21-1584bc6c8d5a";

// ── FOYS API ──────────────────────────────────────────────────────────────────

const FOYS_MATCHES_API = "https://api.foys.io/competition/management-api/v1/matches";
const PAGE_SIZE = 30;

interface FoysMatchTeam {
  id: number;
  name: string;
}

interface FoysMatchOrganisation {
  id: string;
  name: string;
}

interface FoysAccommodationAddress {
  address1: string | null;
  houseNumber: string | null;
  zipCode: string | null;
  city: string | null;
}

interface FoysAccommodation {
  id: string;
  name: string;
  address: FoysAccommodationAddress | null;
}

interface FoysField {
  id: string;
  name: string;
}

interface FoysMatchForm {
  matchId: number;
  homeTeamStatus: string;
  awayTeamStatus: string;
  refereeStatus: string;
  gameNotes: string | null;
  spectatorsAmount: number | null;
}

interface FoysMatch {
  id: number;
  status: string;
  date: string;
  startTime: string | null;
  isFriendly: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: FoysMatchTeam;
  awayTeam: FoysMatchTeam;
  homeOrganisation: FoysMatchOrganisation | null;
  awayOrganisation: FoysMatchOrganisation | null;
  competitionId: number;
  competitionType: { id: number; name: string };
  poolId: number | null;
  playRoundId: number | null;
  accommodation: FoysAccommodation | null;
  field: FoysField | null;
  matchForm: FoysMatchForm | null;
}

interface FoysMatchesResponse {
  totalCount: number;
  items: FoysMatch[];
}

export async function fetchMatchesForTeam(teamId: number): Promise<FoysMatch[]> {
  const allMatches: FoysMatch[] = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_MATCHES_API);
    url.searchParams.set("skipCount", String(skip));
    url.searchParams.set("maxResultCount", String(PAGE_SIZE));
    url.searchParams.set("teamId", String(teamId));
    url.searchParams.set("showOnlyMatchesWithOrganisationsTeams", "true");
    url.searchParams.set("showMatchesWhereClubIsAwayTeam", "false");

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${FOYS_API_KEY}`,
        "X-Cluster": "cluster-default",
      },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Foys API ${res.status} for team ${teamId}: ${body}`);
    }

    const data: FoysMatchesResponse = await res.json();
    totalCount = data.totalCount;
    allMatches.push(...data.items);
    skip += PAGE_SIZE;
  }

  return allMatches;
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts", "matches");

function saveArtifact(filename: string, data: unknown): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved artifact: ${filePath}`);
}

// ── Database ──────────────────────────────────────────────────────────────────

type Db = ReturnType<typeof postgres<Contract>>;

interface DbTeam {
  foysCompetitionTeamId: number;
  name: string | null;
  season: string;
  teamType: string;
}

export async function queryTeams(
  db: Db,
  filter: { season?: string; teamType?: string } = {},
): Promise<DbTeam[]> {
  const filterSeason = filter.season;
  const filterTeam = filter.teamType ? filter.teamType.toUpperCase() : undefined;
  const results: DbTeam[] = [];

  const push = (t: { foysCompetitionTeamId: number; name: string | null; season: string; teamType: string }): void => {
    results.push({ foysCompetitionTeamId: t.foysCompetitionTeamId, name: t.name, season: t.season, teamType: t.teamType });
  };

  if (filterSeason && filterTeam) {
    const rows = await db.orm.public.Team
      .select("foysCompetitionTeamId", "name", "season", "teamType")
      .where({ season: filterSeason })
      .all();
    for (const t of rows) {
      if (String(t.teamType) === filterTeam) push({ foysCompetitionTeamId: t.foysCompetitionTeamId, name: t.name, season: t.season, teamType: String(t.teamType) });
    }
    return results;
  }
  if (filterSeason) {
    const rows = await db.orm.public.Team
      .select("foysCompetitionTeamId", "name", "season", "teamType")
      .where({ season: filterSeason })
      .all();
    for (const t of rows) {
      push({ foysCompetitionTeamId: t.foysCompetitionTeamId, name: t.name, season: t.season, teamType: String(t.teamType) });
    }
    return results;
  }
  if (filterTeam) {
    const rows = await db.orm.public.Team
      .select("foysCompetitionTeamId", "name", "season", "teamType")
      .all();
    for (const t of rows) {
      if (String(t.teamType) === filterTeam) push({ foysCompetitionTeamId: t.foysCompetitionTeamId, name: t.name, season: t.season, teamType: String(t.teamType) });
    }
    return results;
  }
  const rows = await db.orm.public.Team
    .select("foysCompetitionTeamId", "name", "season", "teamType")
    .all();
  for (const t of rows) {
    push({ foysCompetitionTeamId: t.foysCompetitionTeamId, name: t.name, season: t.season, teamType: String(t.teamType) });
  }
  return results;
}

interface UpsertMatchParams {
  foysMatchId: number;
  status: string;
  date: Temporal.PlainDateTime;
  startTime: string | null;
  isFriendly: boolean;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamFoysId: number;
  awayTeamFoysId: number;
  awayTeamName: string;
  awayOrganisationId: string | null;
  awayOrganisationName: string | null;
  competitionId: number;
  competitionTypeName: string;
  field: string | null;
}

export async function upsertMatch(db: Db, p: UpsertMatchParams): Promise<void> {
  await db.orm.public.Match.upsert({
    create: {
      foysMatchId: p.foysMatchId,
      status: p.status as never,
      date: p.date,
      startTime: p.startTime,
      isFriendly: p.isFriendly,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      homeTeamFoysId: p.homeTeamFoysId,
      awayTeamFoysId: p.awayTeamFoysId,
      awayTeamName: p.awayTeamName,
      awayOrganisationId: p.awayOrganisationId,
      awayOrganisationName: p.awayOrganisationName,
      competitionId: p.competitionId,
      competitionTypeName: p.competitionTypeName,
      field: (p.field as never) ?? undefined,
    },
    update: {
      status: p.status as never,
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      homeTeamFoysId: p.homeTeamFoysId,
      awayTeamFoysId: p.awayTeamFoysId,
      awayTeamName: p.awayTeamName,
      awayOrganisationId: p.awayOrganisationId,
      awayOrganisationName: p.awayOrganisationName,
      field: (p.field as never) ?? undefined,
    },
    conflictOn: { foysMatchId: p.foysMatchId },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  if (filterSeason) console.log(`Filtering by season: ${filterSeason}`);
  if (filterTeam) console.log(`Filtering by team type: ${filterTeam}`);

  // 1. Query teams from database
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });
  const teams = await queryTeams(db, { season: filterSeason, teamType: filterTeam });
  console.log(`Found ${teams.length} teams in database.\n`);

  if (teams.length === 0) {
    console.log("No teams to process. Run sync:teams first if needed.");
    await pool.end();
    return;
  }

  let upserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const team of teams) {
    const label = `${team.name || "?"} (${team.teamType}, ${team.season})`;
    console.log(`Fetching matches for ${label}...`);

    let matches: FoysMatch[];
    try {
      matches = await fetchMatchesForTeam(team.foysCompetitionTeamId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  Error fetching matches for ${label}: ${message}`);
      errors++;
      continue;
    }

    saveArtifact(`${team.foysCompetitionTeamId}.json`, matches);

    const homeMatches = matches.filter(
      (m) => m.homeOrganisation?.id === US_ORGANISATION_ID
    );
    console.log(`  ${matches.length} total, ${homeMatches.length} US home matches`);

    for (const match of homeMatches) {
      if (!match.date) {
        skipped++;
        continue;
      }

      if (dryRun) {
        const date = match.date?.slice(0, 10) ?? "no-date";
        const score = match.homeScore != null ? `${match.homeScore}-${match.awayScore}` : "tbd";
        console.log(`  Would upsert: ${date} ${match.startTime || ""} vs ${match.awayTeam.name} (${score}) [${match.status}]`);
        continue;
      }

      try {
        await upsertMatch(db, {
          foysMatchId: match.id,
          status: mapMatchStatus(match.status)!,
          date: Temporal.PlainDateTime.from(match.date),
          startTime: match.startTime,
          isFriendly: match.isFriendly,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeTeamFoysId: match.homeTeam.id,
          awayTeamFoysId: match.awayTeam.id,
          awayTeamName: match.awayTeam.name,
          awayOrganisationId: match.awayOrganisation?.id ?? null,
          awayOrganisationName: match.awayOrganisation?.name ?? null,
          competitionId: match.competitionId,
          competitionTypeName: match.competitionType.name,
          field: mapFieldType(match.field?.name),
        });
        upserted++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`  Error upserting match ${match.id}: ${message}`);
        errors++;
      }
    }
  }

  await pool.end();

  console.log(
    `\nDone. Upserted: ${upserted}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

if (isMainModule(import.meta.url)) {
  void main();
}
