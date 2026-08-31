#!/usr/bin/env node

// Backfill: assign a club member (by NBB number) to a single match-official
// slot on FOYS and mirror the assignment into the local database.
//
// The script only updates EXISTING local Task rows (by foys_task_id, falling
// back to match + task type). It does not create placeholder tasks or users.
//
// PUTs to:
//   https://api.foys.io/competition/management-api/v1/matches/{matchId}/match-officials/{foysTaskId}
//
// with body:
//   { "status": "Planned", "assignedBy": "Club", "note": null,
//     "officialRoleId": <id>, "personId": null,
//     "federationMembershipIdentifier": "<nbbNumber>" }
//
// Usage:
//   npm run backfill:task-assignment \
//     -- --match 506462 --foys-task 428551 --member 116690 --role-id 19
//   npm run backfill:task-assignment -- ... --live     # actually PUT + write
//
// Options:
//   --match <id>        local Match by foys_match_id (required)
//   --foys-task <id>    FOYS match-official slot id (required)
//   --member <nbb>      NBB number of the member to assign (required)
//   --role-id <id>      FOYS officialRoleId (required; e.g. 19 scorer, 20 timer,
//                       21 shot clock, 25 referee)
//   --task-type <type>  local TaskType (REFEREE/TABLE_SCORER/TABLE_TIMER/...).
//                       Used only to locate the local Task when it has no
//                       foys_task_id yet. Default: inferred from --role-id.
//
// Required env vars (in .env.local / .env):
//   DATABASE_URL   PostgreSQL connection string
//   FOYS_API_KEY   Foys bearer token

import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { Pool } from "pg";
import "temporal-polyfill/full/global";
import postgres from "@prisma/orm-postgres/runtime";
import type { Contract } from "../prisma/contract.d";
import contractJson from "../prisma/contract.json";
import type { TaskType } from "../lib/types";
import { isMainModule } from "../lib/is-main";

const dryRun = !process.argv.includes("--live");
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function required(name: string): string {
  const value = getArg(`--${name}`);
  if (!value) {
    console.error(`Missing required argument --${name}`);
    process.exit(1);
  }
  return value;
}

const foysMatchId = Number(required("match"));
const foysTaskId = Number(required("foys-task"));
const nbbNumber = required("member").trim();
const officialRoleId = Number(required("role-id"));
const taskTypeArg = getArg("--task-type");

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

// FOYS officialRoleId -> local TaskType. Used to locate the local Task and to
// derive the task type when --task-type is not given.
const ROLE_ID_TO_TASK_TYPE: Record<number, TaskType> = {
  19: "TABLE_SCORER",
  20: "TABLE_TIMER",
  21: "TABLE_24S_SHOT_CLOCK",
  25: "REFEREE",
};

const FOYS_ASSIGN_OFFICIAL_API = (matchId: number, officialId: number) =>
  `https://api.foys.io/competition/management-api/v1/matches/${matchId}/match-officials/${officialId}`;

interface AssignBody {
  status: string;
  assignedBy: string;
  note: null;
  officialRoleId: number;
  personId: null;
  federationMembershipIdentifier: string;
}

async function assignToFoys(
  matchId: number,
  officialId: number,
  body: AssignBody,
): Promise<void> {
  const res = await fetch(FOYS_ASSIGN_OFFICIAL_API(matchId, officialId), {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${FOYS_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`FOYS assign official PUT ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  validateEnv();

  const taskType: TaskType = (taskTypeArg as TaskType) ?? ROLE_ID_TO_TASK_TYPE[officialRoleId];
  if (taskTypeArg && !(taskType in ROLE_ID_TO_TASK_TYPE)) {
    console.error(`Unrecognized --task-type "${taskTypeArg}".`);
    process.exit(1);
  }
  if (!taskType && !taskTypeArg) {
    console.error(
      `No task type known for --role-id ${officialRoleId}. Pass --task-type explicitly.`,
    );
    process.exit(1);
  }

  console.log(dryRun ? "=== DRY RUN (no writes) ===\n" : "=== LIVE (writes) ===\n");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = postgres<Contract>({ contractJson, pg: pool });

  try {
    // 1. Find the local User by NBB number.
    const user = await db.orm.public.User.where((u) => u.nbbNumber.eq(nbbNumber)).first();
    if (!user) {
      console.error(`No local user with NBB number "${nbbNumber}".`);
      return;
    }
    console.log(
      `Member: ${user.firstName} ${user.lastName} (${user.nbbNumber}, id ${user.id})`,
    );

    // 2. Find the local Match by foysMatchId.
    const match = await db.orm.public.Match.where((m) => m.foysMatchId.eq(foysMatchId)).first();
    if (!match) {
      console.error(`No local match with FOYS match id ${foysMatchId}.`);
      return;
    }
    console.log(`Match: ${match.id} (foys ${foysMatchId})`);

    // 3. Find the local Task by foysTaskId, else by match + task type.
    let task = await db.orm.public.Task.where((t) => t.foysTaskId.eq(foysTaskId)).first();
    if (!task) {
      console.log(
        `No local task with foys_task_id ${foysTaskId}; looking up by match + taskType ${taskType}.`,
      );
      task = await db.orm.public.Task.where((t) => t.matchId.eq(match.id))
        .where((t) => t.taskType.eq(taskType))
        .first();
    }
    if (!task) {
      console.error(
        `No local task to update for match ${foysMatchId} and taskType ${taskType}.`,
      );
      return;
    }
    console.log(
      `Task: ${task.id} (type ${task.taskType}, current foys_task_id ${task.foysTaskId ?? "null"})`,
    );

    // 4. PUT to FOYS.
    const body: AssignBody = {
      status: "Planned",
      assignedBy: "Club",
      note: null,
      officialRoleId,
      personId: null,
      federationMembershipIdentifier: nbbNumber,
    };
    console.log(`PUT ${FOYS_ASSIGN_OFFICIAL_API(foysMatchId, foysTaskId)}`);
    console.log(`  body: ${JSON.stringify(body)}`);

    // 5. Mirror into the local database.
    const needsFoysTaskId = task.foysTaskId == null || task.foysTaskId !== foysTaskId;
    const existingAssignment = await db.orm.public.TaskAssignment.where((a) =>
      a.taskId.eq(task.id),
    )
      .where((a) => a.userId.eq(user.id))
      .first();

    if (dryRun) {
      console.log(
        `  Would set task.foys_task_id=${foysTaskId}${needsFoysTaskId ? "" : " (unchanged)"}`,
      );
      console.log(
        existingAssignment
          ? "  Assignment already exists locally (would skip)."
          : `  Would create TaskAssignment (task ${task.id}, user ${user.id}).`,
      );
      return;
    }

    await assignToFoys(foysMatchId, foysTaskId, body);
    console.log("  FOYS PUT OK.");

    if (needsFoysTaskId) {
      await db.orm.public.Task.where((t) => t.id.eq(task.id)).update({
        foysTaskId,
      });
      console.log(`  Updated task.foys_task_id -> ${foysTaskId}.`);
    }

    if (!existingAssignment) {
      await db.orm.public.TaskAssignment.create({
        taskId: task.id,
        userId: user.id,
        nbbNumber,
        isDouble: false,
      });
      console.log(`  Created TaskAssignment (task ${task.id}, user ${user.id}).`);
    } else {
      console.log("  Assignment already exists locally; left unchanged.");
    }

    console.log("\nDone.");
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
  } finally {
    await pool.end();
  }
}

if (isMainModule(import.meta.url)) {
  void main();
}
