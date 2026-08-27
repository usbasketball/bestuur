# US Bestuur

Service for US basketball board (bestuur) administration.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| i18n | next-intl (locale routing, EN + NL) |
| Auth | Auth0 (`@auth0/nextjs-auth0`) — Universal Login |
| DB | PostgreSQL + Prisma 8 ORM (contract workflow) |
| Deploy | Vercel (native Git integration) |

## Getting Started

Prerequisites: Node.js 20+ and access to a PostgreSQL database (e.g. Neon).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill in the required values. See `.env.example` for descriptions of each variable.

3. Emit the Prisma contract and set up the database:

   ```bash
   npm run contract:emit
   npm run db:init
   ```

   For an existing database, use `db update` instead of `db init` to avoid dropping
   tables that aren't in the contract.

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). The app is available under both `/en` and `/nl`.

## Database

PostgreSQL on Neon, shared with the [usbasketballnl](https://github.com/usbasketball/usbasketballnl) app. Schema defined in `prisma/contract.prisma` using the Prisma 8 contract workflow.

See [doc/database.md](doc/database.md) for models, enums, roles, and schema change workflow.

## Syncing Data from FOYS

See [doc/syncing.md](doc/syncing.md) for all sync scripts (users, teams, home matches).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check the project (`tsc --noEmit`) |
| `npm run contract:emit` | Emit the Prisma contract (`prisma/contract.json` + `contract.d.ts`) |
| `npm run db:init` | Bootstrap a new database to match the current contract |
| `npm run db:update` | Update the database schema to match the contract (safe for existing tables) |
| `npm run sync:users` | Sync users from FOYS + Auth0 (dry run by default; add `--live` to write) |
| `npm run sync:teams` | Sync teams from FOYS (dry run by default; add `--live` to write) |
| `npm run sync:matches` | Sync home matches from FOYS (dry run by default; add `--live` to write) |

## Project Structure

```
bestuur/
├── app/                    # Next.js App Router pages
├── doc/                    # Documentation
│   ├── database.md         # Database models, roles, and schema workflow
│   └── syncing.md          # FOYS sync scripts (users, teams, matches)
├── lib/                    # Shared utilities and constants
│   └── types/              # REFEREE_LEVELS, TAG_CODE_TO_LEVEL, TEAM_TYPES, mapTeamType
├── prisma/
│   └── contract.prisma     # Database schema (source of truth)
├── scripts/
│   ├── sync-users.ts       # FOYS + Auth0 user sync
│   ├── sync-teams.ts       # FOYS team sync
│   └── sync-home-matches.ts # FOYS home match sync
└── ...
```
