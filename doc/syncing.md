# Syncing Data from FOYS

## Users

The `sync:users` script fetches active members from [FOYS](https://foys.io), links
Auth0 identities by email, fetches referee diplomas and member-since dates, and
upserts everything into the local `users` table.

```bash
npm run sync:users          # dry run (default)
npm run sync:users -- --live   # write to the database
```

Requires `FOYS_API_KEY`, `AUTH0_M2M_DOMAIN`, `AUTH0_M2M_CLIENT_ID`, and
`AUTH0_M2M_CLIENT_SECRET` in your `.env.local`.

## Teams

The `sync:teams` script fetches all teams from FOYS and upserts them into the `competition_teams` table.
Team names are mapped to TeamType enum values (e.g., "MSE-2" → `MSE2`, "3x3" → `V3x3`).

```bash
npm run sync:teams          # dry run (default)
npm run sync:teams -- --live   # write to the database
```

Requires `FOYS_API_KEY` in your `.env.local`.

## Club memberships

The `sync:club-memberships` script iterates over existing local `users` that have a
`foys_user_id`, fetches each person's **plan assignments** from
`/foys/api/v1/management/plan-assignments/person/{guid}`, and upserts a club
membership per (user, season) into the `club_memberships` table.

Only the club's own membership plans are kept (`plan.tenantType === "Club"`), e.g.
"Wedstrijdspelend 1x/2x trainen", "Recreanten", "3x3 lid" — federation NBB
match-license plans ("Wedstrijd spelend lid", "Recreant lid", "Niet-spelend lid")
are excluded. Multiple club plans in the same (user, season) are collapsed into
one row, preferring a competition plan. The season is derived from the plan's
**end date** (seasons end in summer, so an end date of 2027-07-31 → `2026-2027`).

Membership type is derived from the plan name via `mapPlanMembershipType()` in
`lib/types/club-membership-type.ts`. `primary_team` / `registered_team` are not present
in this payload and are currently left `NULL`.

```bash
npm run sync:club-memberships               # dry run (default)
npm run sync:club-memberships -- --live     # write to the database
```

## Home matches

The `sync:matches` script loops through the `competition_teams` table and fetches
matches from the FOYS API for each team. Only US home games are synced (filtered by
`homeOrganisation.id`). Supports filtering by season and/or team type.

```bash
npm run sync:matches                           # dry run (default)
npm run sync:matches -- --live                 # write to the database
npm run sync:matches -- --season 2025-2026     # filter by season
npm run sync:matches -- --team MSE1            # filter by team type
npm run sync:matches -- --live --season 2025-2026 --team MSE1  # combined
```

The `--season` flag filters which teams to query (by the `season` column on
`competition_teams`). Each team entry in FOYS is tied to a specific season, so
the API returns matches for that season only.

Requires `FOYS_API_KEY` in your `.env.local`.

## Local API artifacts

Raw responses pulled from FOYS are saved to `scripts/artifacts/` (gitignored) so
the exact shape of the data can be inspected during local development:

- `sync:users` writes `scripts/artifacts/users.json` (all members) and
  `scripts/artifacts/person-detail.sample.json` (a sample of raw person details).
- `sync:teams` writes `scripts/artifacts/teams.json` (all teams).
- `sync:matches` writes `scripts/artifacts/matches/<foysTeamId>.json` (raw
  matches fetched per team).
- `sync:club-memberships` writes `scripts/artifacts/club-memberships/<foysUserId>.json`
  (raw plan assignments for each synced user).

Requires `FOYS_API_KEY` in your `.env.local`. Run `sync:users` first so users with
`foys_user_id` exist in the database.