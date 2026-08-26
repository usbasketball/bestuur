# US Bestuur

Service for US basketball board (bestuur) administration.

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| i18n | next-intl (locale routing, EN + NL) |
| Auth | Auth0 (`@auth0/nextjs-auth0`) — Universal Login |
| DB | PostgreSQL + Prisma 8 ORM |
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

The schema is defined in `prisma/contract.prisma` and currently contains a single `User` model:

| Column | Type | Description |
|---|---|---|
| `id` | text (uuid) | Primary key |
| `auth0_sub` | text? | Auth0 user ID (unique) |
| `email` | text | Email address (unique) |
| `first_name` | text? | First name |
| `last_name_prefix` | text? | Dutch name prefix (e.g. "van", "de") |
| `last_name` | text? | Last name |
| `nbb_number` | text? | NBB federation membership number (unique) |
| `foys_user_id` | text? | FOYS GUID (unique) |
| `referee_level` | text? | Highest referee diploma (e.g. "Scheidsrechter E-diploma") |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last modification time |

After changing the contract, re-emit and re-sign:

```bash
npm run contract:emit
npx prisma db sign
```

## Syncing Users

The `sync:users` script fetches active members from [FOYS](https://foys.io), links
Auth0 identities by email, fetches referee diplomas, and upserts everything into the
local `users` table.

```bash
npm run sync:users          # dry run (default)
npm run sync:users -- --live   # write to the database
```

Requires `FOYS_API_KEY`, `AUTH0_M2M_DOMAIN`, `AUTH0_M2M_CLIENT_ID`, and
`AUTH0_M2M_CLIENT_SECRET` in your `.env.local`.

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
| `npm run db:migrate` | Plan and apply a migration |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run sync:users` | Sync users from FOYS + Auth0 (dry run by default; add `--live` to write) |
