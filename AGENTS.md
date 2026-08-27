<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Rules

## Database

- Schema: `prisma/contract.prisma` (Prisma 8 contract workflow)
- Full docs: [doc/database.md](doc/database.md)
- Never run `prisma db update` without checking with the user first — it applies directly to production
- After schema changes, always run `npm run contract:emit` before `npm run db:update`

## Shared Code

- Shared constants live in `lib/types/` (referee-level.ts, team-type.ts, index.ts)
- Sync scripts import from `lib/types` — keep them in sync
- Sync scripts: [doc/syncing.md](doc/syncing.md) (users, teams, home matches)

## Conventions

- TypeScript strict mode
- Tailwind CSS v4 for styling
- next-intl for i18n (EN + NL)
- Auth0 for authentication
