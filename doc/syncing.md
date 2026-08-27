# Syncing Data from FOYS

## Users

The `sync:users` script fetches active members from [FOYS](https://foys.io), links
Auth0 identities by email, fetches referee diplomas, and upserts everything into the
local `users` table.

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

## Home Matches

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
