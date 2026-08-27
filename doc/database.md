# Database

PostgreSQL database hosted on Neon, shared between the [bestuur](https://github.com/usbasketball/bestuur) and [usbasketballnl](https://github.com/usbasketball/usbasketballnl) apps.

Schema is defined in `prisma/contract.prisma` using the Prisma 8 contract workflow.

## Models

### User

Board members synced from FOYS + Auth0.

| Column | Type | DB column | Constraints |
|---|---|---|---|
| `id` | text (uuid) | `id` | PK, auto-generated |
| `auth0Sub` | text? | `auth0_sub` | UNIQUE |
| `email` | text | `email` | UNIQUE, NOT NULL |
| `firstName` | text? | `first_name` | |
| `lastNamePrefix` | text? | `last_name_prefix` | |
| `lastName` | text? | `last_name` | |
| `nbbNumber` | text? | `nbb_number` | UNIQUE |
| `foysUserId` | text? | `foys_user_id` | UNIQUE |
| `refereeLevel` | text? | `referee_level` | |
| `memberSince` | datetime | `member_since` | |
| `createdAt` | datetime | `created_at` | DEFAULT now() |
| `updatedAt` | datetime | `updated_at` | auto-updated |

### Team

Teams from FOYS, categorized by `TeamType` enum.

| Column | Type | DB column | Constraints |
|---|---|---|---|
| `id` | text (uuid) | `id` | PK, auto-generated |
| `foysTeamId` | int | `foys_team_id` | UNIQUE, NOT NULL |
| `season` | text | `season` | NOT NULL |
| `teamType` | TeamType | `team_type` | NOT NULL |
| `createdAt` | datetime | `created_at` | DEFAULT now() |
| `updatedAt` | datetime | `updated_at` | auto-updated |

Unique constraint: `(teamType, season)`
Table name: `competition_teams`

### InterestSubmission

Interest form submissions from usbasketball.nl.

| Column | Type | DB column | Constraints |
|---|---|---|---|
| `id` | text (uuid) | `id` | PK, auto-generated |
| `name` | text | `name` | NOT NULL |
| `email` | text | `email` | NOT NULL, INDEXED |
| `birthDate` | datetime | `birth_date` | NOT NULL |
| `position` | text | `position` | NOT NULL |
| `interest` | text | `interest` | NOT NULL |
| `gender` | text | `gender` | NOT NULL |
| `lastLevel` | text? | `last_level` | |
| `lastSeason` | text? | `last_season` | |
| `background` | text? | `background` | |
| `locale` | text | `locale` | DEFAULT 'nl' |
| `createdAt` | datetime | `created_at` | DEFAULT now() |

### ClubMembership

A person's club membership in a season, linked to a `User`. Synced from FOYS by
`sync:club-memberships` (only the club's own plans, not federation match-licences).

| Column | Type | DB column | Constraints |
|---|---|---|---|
| `id` | text (uuid) | `id` | PK, auto-generated |
| `userId` | text (uuid) | `user_id` | FK → users.id, NOT NULL |
| `season` | text | `season` | NOT NULL |
| `primaryTeam` | TeamType? | `primary_team` | |
| `registeredTeam` | TeamType? | `registered_team` | |
| `membershipType` | ClubMembershipType | `membership_type` | NOT NULL |
| `cancelledAt` | datetime | `cancelled_at` | |
| `createdAt` | datetime | `created_at` | DEFAULT now() |
| `updatedAt` | datetime | `updated_at` | auto-updated |

Unique constraint: `(user_id, season)` (one club membership per user per season)
Indexed: `season`
Table name: `club_memberships`

## Enums

### TeamType

| Value | Description |
|---|---|
| `VSE1`–`VSE6` | Vrouwen teams (6 levels) |
| `MSE1`–`MSE6` | Mannen teams (6 levels) |
| `V3x3` | 3x3 Basketball teams |

Team names are mapped from FOYS using `mapTeamType()` in `lib/constants.ts`:
- Strip `-`, `*`, whitespace, uppercase: `"MSE-2"` → `MSE2`, `"VSE-6**"` → `VSE6`
- Fallback: if disciplines contain `"3x3 Basketball"`, map to `V3x3`

### ClubMembershipType

| Value | Description |
|---|---|
| `COMPETITION` | Competition/first-team membership |
| `RECREATIONAL` | Recreational membership |

Mapped from FOYS club plan names using `mapPlanMembershipType()` in
`lib/types/club-membership-type.ts`.

## Database Roles

| Role | Access | Used by |
|---|---|---|
| `neon_db` | Admin (default Neon role) | Neon console / migrations admin |
| `bestuur` | Full access; owns schema (creates via `db:update`) | bestuur app |
| `usbasketball` | Read-only on shared tables + INSERT on `interest_submissions` | usbasketballnl app |

## Contract Workflow

Prisma 8 uses a contract-based workflow instead of traditional `prisma migrate`:

1. Define schema in `prisma/contract.prisma`
2. `npm run contract:emit` — generates `prisma/contract.json` + `prisma/contract.d.ts`
3. `npm run db:update` — applies changes directly to the database

**Important:** `db update` applies changes directly to production. Always:
- Run `contract:emit` before `db:update`
- Review changes before applying

### Adding a new table

1. Add the model to `prisma/contract.prisma`
2. Run `npm run contract:emit`
3. Run `npm run db:update`
