#!/usr/bin/env node

// One-off backfill: bulk-add member(s) to a FOYS team roster for a season.
//
// Posts to:
//   POST https://api.foys.io/foys/api/v1/management/teams/{teamId}/members/bulk
//
// with body:
//   { "teamId": <teamId>, "start": "<start>", "memberIds": [...], "teamRoleId": <teamRoleId> }
//   and optionally "end": "<end>" for the membership end date.
//
// Usage:
//   npm run backfill:team-members                                    # dry run (default)
//   npm run backfill:team-members -- --live                          # actually POST
//   npm run backfill:team-members -- --team 68464 --members d4b90dd9-2493-4699-9eeb-16afedc51a39
//   npm run backfill:team-members -- --role coach ...                 # backfill coaches
//   npm run backfill:team-members -- --team 68464 --members id1,id2 --start 2026-08-01 --team-role 2182
//   npm run backfill:team-members -- --end 2027-07-31                # also set an end date
//
// Options (defaults match a specific backfill run):
//   --team <id>          FOYS team id (default: 68464)
//   --members <ids>      comma-separated FOYS user ids (default: d4b90dd9-2493-4699-9eeb-16afedc51a39)
//   --role <role>        team role: "player" (default) or "coach"
//   --start <date>       membership start date YYYY-MM-DD (default: 2026-08-01)
//   --end <date>         membership end date YYYY-MM-DD (optional)
//   --team-role <id>     FOYS team role id (overrides --role; default: 2182, coach 4237)
//
// Required env vars (in .env.local / .env):
//   FOYS_API_KEY   Foys bearer token

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { isMainModule } from "../lib/is-main";

const dryRun = !process.argv.includes("--live");
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const TEAM_ROLES = { player: 2182, coach: 4237 } as const;
type TeamRoleName = keyof typeof TEAM_ROLES;

const roleArg = getArg("--role");
const role: TeamRoleName = roleArg === "coach" ? "coach" : "player";

const teamId = Number(getArg("--team") ?? "68464");
const membersArg = getArg("--members") ?? "d4b90dd9-2493-4699-9eeb-16afedc51a39";
const start = getArg("--start") ?? "2026-08-01";
const end = getArg("--end") ?? "2027-07-31";
const teamRoleId = Number(getArg("--team-role") ?? TEAM_ROLES[role]);

const memberIds = membersArg
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const FOYS_API_KEY = process.env.FOYS_API_KEY;

function validateEnv(): void {
  if (!FOYS_API_KEY) {
    console.error("Missing FOYS_API_KEY env var.");
    process.exit(1);
  }

  if (!Number.isFinite(teamId) || memberIds.length === 0 || !Number.isFinite(teamRoleId)) {
    console.error("Missing or invalid --team / --members / --team-role.");
    process.exit(1);
  }
}

// ── FOYS API ──────────────────────────────────────────────────────────────────

const FOYS_MEMBERS_BULK_API = (team: number) =>
  `https://api.foys.io/foys/api/v1/management/teams/${team}/members/bulk`;

interface BulkTeamMembersRequest {
  teamId: number;
  start: string;
  memberIds: string[];
  teamRoleId: number;
  end?: string;
}

export async function bulkAddTeamMembers(req: BulkTeamMembersRequest): Promise<unknown> {
  const res = await fetch(FOYS_MEMBERS_BULK_API(req.teamId), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${FOYS_API_KEY}`,
      "X-Cluster": "cluster-default",
    },
    body: JSON.stringify(req),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(`Foys API ${res.status}: ${bodyText}`);
  }

  const data = bodyText ? JSON.parse(bodyText) : null;
  return data;
}

// ── Artifacts (local dev inspection) ──────────────────────────────────────────

const ARTIFACTS_DIR = path.join(rootDir, "scripts", "artifacts", "team-members");

function saveArtifact(filename: string, data: unknown): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const filePath = path.join(ARTIFACTS_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`  Saved artifact: ${filePath}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  validateEnv();

  const request: BulkTeamMembersRequest = {
    teamId,
    start,
    memberIds,
    teamRoleId,
    ...(end ? { end } : {}),
  };

  console.log(`Team ${teamId}, role ${role} (${teamRoleId}), start ${start}${end ? `, end ${end}` : ""}, members: ${memberIds.join(", ")}\n`);

  if (dryRun) {
    console.log("=== DRY RUN (no request sent) ===\n");
    console.log(`POST ${FOYS_MEMBERS_BULK_API(request.teamId)}`);
    console.log(JSON.stringify(request, null, 2));
    console.log("\nPass --live to actually POST this backfill.");
    return;
  }

  saveArtifact(`${teamId}.${role}.request.json`, request);

  try {
    const result = await bulkAddTeamMembers(request);
    saveArtifact(`${teamId}.${role}.response.json`, result);
    console.log(`Backfill done: ${result ? JSON.stringify(result) : "no response body"}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error posting team members for team ${teamId}: ${message}`);
    process.exitCode = 1;
  }
}

if (isMainModule(import.meta.url)) {
  void main();
}