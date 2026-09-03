# GraphQL

The app exposes a single GraphQL endpoint served by [graphql-yoga](https://the-guild.dev/graphql/yoga-server) at `POST /api/graphql`. Server-side, the schema is defined **code-first** with [Pothos](https://pothos-graphql.dev), and client-side the typed operations are generated with [graphql-codegen](https://the-guild.dev/graphql/codegen).

## Architecture

```
server:  lib/graphql/schema/*       Pothos code-first schema (source of truth)
client:  app/**/page.tsx            urql useQuery/useMutation + graphql() operations
generated: lib/graphql/generated/   graphql-codegen output (NOT committed)
bridge:  lib/graphql/schema.graphql committed schema snapshot
```

### Server (Pothos code-first)

- `lib/graphql/schema/builder.ts` — `SchemaBuilder` instance. `defaultFieldNullability = false`, so fields are non-null by default; opt into nullability with `{ nullable: true }`.
- `lib/graphql/schema/context.ts` — `GraphQLContext` (session, auth helpers).
- `lib/graphql/schema/types/` — DTO types + object refs. Each type maps an explicit **DB → DTO → GQL** shape:
  - `scalars.ts` — `UUID`, `DateTime` scalars
  - `enums.ts` — the GraphQL enums (exported refs, e.g. `MatchStatusEnum`)
  - `user.ts`, `member.ts`, `team.ts`, `task.ts`, `match.ts`
- `lib/graphql/schema/queries/index.ts` — `Query` fields: `matches`, `members`, `activeMembers`, `teams`, `me`.
- `lib/graphql/schema/mutations/tasks.ts` — `Mutation` fields: `upsertTaskAssignment`.
- `lib/graphql/schema/loaders.ts`, `load-match-data.ts` — DataLoader-style batch loading (users, members, matches + task assignments). Prefer batch loading here over lazy per-field resolution.
- `lib/graphql/schema/index.ts` — assembles the schema via `builder.toSchema()`.

### Client (urql + codegen)

- Pages define their own operations with the typed `graphql()` helper, e.g. in `app/[locale]/dashboard/teams/page.tsx`:

  ```ts
  import { graphql } from "@/lib/graphql/generated";

  const TEAMS_QUERY = graphql(`
    query Teams($season: String) {
      teams(season: $season) { id name season teamType discipline }
    }
  `);
  ```

- Components consume them with urql (`useQuery`/`useMutation`) using the typed result types.

## Regenerating schema & client types

`lib/graphql/generated/*` are generated artifacts and are **not committed**. Regenerate them from the committed sources (`lib/graphql/schema/*` and the pages' `graphql()` operations):

| Command | Produces |
|---|---|
| `npm run schema:generate` | `lib/graphql/schema.graphql` (from the Pothos schema) |
| `npm run codegen` | `lib/graphql/generated/*` (types + documents) |
| `npm run codegen:watch` | Re-run codegen on file changes |
| `npm run prebuild` | Emits Prisma contract, then schema:generate + codegen |

CI runs `schema:generate && codegen` before typecheck/tests, mirroring the gitignored Prisma contract artifacts.

## Context & auth

- Requests are authenticated against the Auth0 session or a Bearer JWT (`lib/api-auth.ts`).
- Mutations/queries that require board access call `assertBestuur(ctx)`; the `me` query uses `requireSession(ctx)` and resolves via the `loadUserByAuth0Sub` loader.
- `lib/types/index.ts` re-exports the response DTO types that components rely on.

## Schema

The generated schema is committed at `lib/graphql/schema.graphql`. Root fields:

- `Query`: `matches(season)`, `members(season)`, `activeMembers(season)`, `teams(season)`, `me`
- `Mutation`: `upsertTaskAssignment(assignmentId, taskId, memberId, season)`

Notable intentional nullability choices:

- `homeTeam` and `awayTeam.organisation` are nullable (previously latent bugs in the hand-written schema).
- `matches` returns a nullable list (`[Match]!`) — matches without full data can be present.