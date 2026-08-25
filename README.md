# US Bestuur

Service for US basketball board (bestuur) administration.


## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| i18n | next-intl (locale routing, EN + NL) |
| Auth | Auth0 (`@auth0/nextjs-auth0`) — Universal Login |
| DB | PostgreSQL + Prisma ORM (client generated into `lib/generated`) |
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

3. Generate the Prisma client and set up the database:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000). The app is available under both `/en` and `/nl`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check the project (`tsc --noEmit`) |
| `npm run db:generate` | Generate the Prisma client into `lib/generated/prisma` |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply pending migrations (production) |
| `npm run db:studio` | Open Prisma Studio |
