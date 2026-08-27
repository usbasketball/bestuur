#!/usr/bin/env node

// Sync users from FOYS (source of truth) and link Auth0 identities.
//
// 1. Fetches active members from the FOYS API
// 2. Fetches all Auth0 users via Management API (to link auth0_sub by email)
// 3. Upserts each member into the local PostgreSQL users table
//
// Usage:
//   npm run sync:users               # dry run (default)
//   npm run sync:users -- --live     # actually write to the database
//
// Required env vars (in .env.local / .env):
//   DATABASE_URL              PostgreSQL connection string
//   AUTH0_DOMAIN              e.g. auth.usbasketball.nl
//   AUTH0_M2M_CLIENT_ID       M2M app client ID (needs Management API access)
//   AUTH0_M2M_CLIENT_SECRET   M2M app client secret
//   FOYS_API_KEY              Foys bearer token

import { Pool, QueryResult } from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { REFEREE_LEVELS, TAG_CODE_TO_LEVEL } from "../lib/types";

const dryRun = !process.argv.includes("--live");

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const DATABASE_URL = process.env.DATABASE_URL;
const AUTH0_M2M_DOMAIN = process.env.AUTH0_M2M_DOMAIN;
const AUTH0_M2M_CLIENT_ID = process.env.AUTH0_M2M_CLIENT_ID;
const AUTH0_M2M_CLIENT_SECRET = process.env.AUTH0_M2M_CLIENT_SECRET;
const FOYS_API_KEY = process.env.FOYS_API_KEY;

if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL env var.");
  process.exit(1);
}

if (!AUTH0_M2M_DOMAIN || !AUTH0_M2M_CLIENT_ID || !AUTH0_M2M_CLIENT_SECRET) {
  console.error("Missing AUTH0_M2M_DOMAIN, AUTH0_M2M_CLIENT_ID, or AUTH0_M2M_CLIENT_SECRET env vars.");
  process.exit(1);
}

if (!FOYS_API_KEY) {
  console.error("Missing FOYS_API_KEY env var.");
  process.exit(1);
}

// ── FOYS API ──────────────────────────────────────────────────────────────────

const FOYS_API = "https://api.foys.io/foys/api/v1/management/people";
const FOYS_TAGS_API = "https://api.foys.io/foys/api/v1/management/person-tags/federation-person";
const PAGE_SIZE = 500;

interface FoysMember {
  fullName: string | null;
  email: string | null;
  federationMembershipIdentifier: string | null;
  guid: string | null;
}

interface FoysMembersResponse {
  totalCount: number;
  items: FoysMember[];
}

interface FoysTag {
  tagCode: string;
}

async function fetchAllFoysMembers(): Promise<FoysMembersResponse> {
  const allMembers = [];
  let skip = 0;
  let totalCount = Infinity;

  while (skip < totalCount) {
    const url = new URL(FOYS_API);
    url.searchParams.set("sorting", "lastName asc");
    url.searchParams.set("hasActiveMembership", "true");
    url.searchParams.set("skipActiveMembershipCheck", "false");
    url.searchParams.set("isUpForReview", "false");
    url.searchParams.set("skipCount", "0");
    url.searchParams.set("maxResultCount", String(PAGE_SIZE));
    url.searchParams.set("quickSearch.isWhere", "true");
    url.searchParams.set("skip", String(skip));

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

    const data: FoysMembersResponse = await res.json();
    totalCount = data.totalCount;
    allMembers.push(...data.items);
    skip += PAGE_SIZE;
    console.log(`  Fetched ${allMembers.length}/${totalCount} members...`);
  }

  return { totalCount, items: allMembers };
}

async function fetchRefereeLevel(nbbNumber: string): Promise<string | null> {
  const url = `${FOYS_TAGS_API}/${nbbNumber}/tag-type/3?federationMembershipIdentifier=${nbbNumber}&activeOnly=true&tagType=3`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${FOYS_API_KEY}`,
      "X-Cluster": "cluster-default",
    },
  });
  if (!res.ok) return null;
  const tags: FoysTag[] = await res.json();
  if (!Array.isArray(tags) || tags.length === 0) return null;

  let highestIdx = -1;
  let highestLevel: string | null = null;
  for (const tag of tags) {
    const level = TAG_CODE_TO_LEVEL[tag.tagCode];
    if (!level) continue;
    const idx = REFEREE_LEVELS.indexOf(level);
    if (idx > highestIdx) {
      highestIdx = idx;
      highestLevel = level;
    }
  }
  return highestLevel;
}

// ── Auth0 Management API ──────────────────────────────────────────────────────

const AUTH0_API = `https://${AUTH0_M2M_DOMAIN}/api/v2`;

let accessToken: string | null = null;

interface Auth0TokenResponse {
  access_token: string;
}

async function getToken(): Promise<string> {
  const res = await fetch(`https://${AUTH0_M2M_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: AUTH0_M2M_CLIENT_ID,
      client_secret: AUTH0_M2M_CLIENT_SECRET,
      audience: `https://${AUTH0_M2M_DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth0 token request failed (${res.status}): ${body}`);
  }
  const data: Auth0TokenResponse = await res.json();
  return data.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mgmtFetch(apiPath: string, options: RequestInit = {}, retries = 3): Promise<unknown> {
  if (!accessToken) accessToken = await getToken();

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${AUTH0_API}${apiPath}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") || "2");
      console.log(`  Rate limited, waiting ${retryAfter}s...`);
      await sleep(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status} ${apiPath}: ${body}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }
  throw new Error(`Too many retries for ${apiPath}`);
}

interface Auth0User {
  email: string;
  user_id: string;
}

interface Auth0UsersResponse {
  users: Auth0User[];
}

async function fetchAllAuth0Users(): Promise<Auth0User[]> {
  const allUsers: Auth0User[] = [];
  let page = 0;
  const perPage = 100;

  while (true) {
    const data = (await mgmtFetch(
      `/users?per_page=${perPage}&page=${page}&include_totals=true`
    )) as Auth0UsersResponse | Auth0User[];

    const users = Array.isArray(data) ? data : data?.users ?? [];
    allUsers.push(...users);
    if (users.length < perPage) break;
    page++;
    await sleep(100);
  }

  return allUsers;
}

// ── Database ──────────────────────────────────────────────────────────────────

interface UpsertUserParams {
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  foysUserId: string | null;
  auth0Sub: string | null;
  refereeLevel: string | null;
}

async function upsertUser(pool: Pool, { email, firstName, lastNamePrefix, lastName, nbbNumber, foysUserId, auth0Sub, refereeLevel }: UpsertUserParams): Promise<QueryResult> {
  const query = `
    INSERT INTO users (id, email, first_name, last_name_prefix, last_name, nbb_number, foys_user_id, auth0_sub, referee_level, created_at, updated_at)
    VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, now(), now())
    ON CONFLICT (email) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name_prefix = EXCLUDED.last_name_prefix,
      last_name = EXCLUDED.last_name,
      nbb_number = COALESCE(EXCLUDED.nbb_number, users.nbb_number),
      foys_user_id = COALESCE(EXCLUDED.foys_user_id, users.foys_user_id),
      auth0_sub = COALESCE(EXCLUDED.auth0_sub, users.auth0_sub),
      referee_level = COALESCE(EXCLUDED.referee_level, users.referee_level),
      updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
  `;
  return pool.query(query, [email, firstName, lastNamePrefix, lastName, nbbNumber, foysUserId, auth0Sub, refereeLevel]);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const DUTCH_PREFIXES = [
  "van den", "van der", "van de", "van het",
  "van", "den", "der", "de", "het", "ten", "ter", "te",
];

interface SplitNameResult {
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
}

function splitName(member: FoysMember): SplitNameResult {
  const fullName = (member.fullName || "").trim();
  if (!fullName) return { firstName: null, lastNamePrefix: null, lastName: null };

  const parts = fullName.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastNamePrefix: null, lastName: null };

  const firstName = parts[0];
  const rest = parts.slice(1);
  const restLower = rest.map((p) => p.toLowerCase()).join(" ");

  // Try longest prefix match first
  for (const prefix of DUTCH_PREFIXES) {
    if (restLower === prefix || restLower.startsWith(prefix + " ")) {
      const prefixWords = prefix.split(" ").length;
      const lastName = rest.slice(prefixWords).join(" ");
      return { firstName, lastNamePrefix: rest.slice(0, prefixWords).join(" "), lastName };
    }
  }

  return { firstName, lastNamePrefix: null, lastName: rest.join(" ") };
}

async function main(): Promise<void> {
  if (dryRun) {
    console.log("=== DRY RUN (no database writes) ===\n");
  }

  // 1. Fetch FOYS members
  console.log("Fetching members from FOYS API...");
  const { items } = await fetchAllFoysMembers();
  console.log(`Fetched ${items.length} members from FOYS.\n`);

  // 2. Fetch Auth0 users and build email → sub map
  console.log("Fetching users from Auth0...");
  const auth0Users = await fetchAllAuth0Users();
  const emailToSub = new Map<string, string>();
  for (const user of auth0Users) {
    if (user.email && user.user_id) {
      emailToSub.set(user.email.toLowerCase(), user.user_id);
    }
  }
  console.log(`Fetched ${auth0Users.length} users from Auth0 (${emailToSub.size} with emails).\n`);

  // Debug: show a sample of Auth0 emails if available
  if (emailToSub.size > 0) {
    const sample = [...emailToSub.entries()].slice(0, 5);
    console.log("Sample Auth0 emails:", sample.map(([e]) => e).join(", "));
  }

  // 3. Connect to database
  const pool = new Pool({ connectionString: DATABASE_URL });

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const member of items) {
    const email = member.email;
    if (!email) {
      console.warn(`Skipping member without email: ${member.fullName}`);
      skipped++;
      continue;
    }

    const { firstName, lastNamePrefix, lastName } = splitName(member);
    const nbbNumber: string | null = member.federationMembershipIdentifier || null;
    const foysUserId: string | null = member.guid || null;
    const auth0Sub: string | null = emailToSub.get(email.toLowerCase()) || null;

    let refereeLevel = null;
    if (nbbNumber) {
      try {
        refereeLevel = await fetchRefereeLevel(nbbNumber);
      } catch {
        // Non-fatal — skip diploma fetch for this member
      }
    }

    if (dryRun) {
      console.log(`Would upsert: ${member.fullName || email} (${email}) — nbb: ${nbbNumber}, auth0: ${auth0Sub ? "yes" : "no"}, referee: ${refereeLevel || "none"}`);
      continue;
    }

    try {
      const result = await upsertUser(pool, {
        email,
        firstName,
        lastNamePrefix,
        lastName,
        nbbNumber,
        foysUserId,
        auth0Sub,
        refereeLevel,
      });
      const inserted = result.rows[0]?.inserted;
      if (inserted) {
        console.log(`Created: ${member.fullName} (${email})`);
        created++;
      } else {
        console.log(`Updated: ${member.fullName} (${email})`);
        updated++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error for ${member.fullName} (${email}): ${message}`);
      errors++;
    }
  }

  await pool.end();

  console.log(
    `\nDone. Created: ${created}, Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`
  );
}

main();
