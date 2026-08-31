import { vi } from "vitest";

// Minimal chainable fake of the `@prisma/orm-postgres` client surface that the
// sync scripts use. Each model exposes `select`, `where`, `upsert`, `first`,
// `update`, `all` as vitest mocks backed by the rows given at construction.
// Tests control the returned rows and assert on the arguments passed through.

type Rows = unknown[];

// Best-effort row filtering for plain-object equality filters (e.g.
// `where({ season: "2026-2027" })`). Function filters (ORM predicates) are not
// executed — the provided rows are assumed to already reflect them.
function matchesFilter(row: Record<string, unknown>, filter: unknown): boolean {
  if (typeof filter === "function") return true;
  if (!filter || typeof filter !== "object") return true;
  return Object.entries(filter as Record<string, unknown>).every(
    ([key, value]) => (row as Record<string, unknown>)[key] === value,
  );
}

interface Chain {
  where: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function selectChain(rows: Rows): {
  where: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
} {
  return {
    where: vi.fn((filter: unknown) => {
      const filtered = rows.filter((row) =>
        matchesFilter(row as Record<string, unknown>, filter),
      );
      return {
        all: vi.fn(async () => filtered),
        first: vi.fn(async () => filtered[0] ?? null),
      };
    }),
    all: vi.fn(async () => rows),
    first: vi.fn(async () => rows[0] ?? null),
  };
}

function whereChain(rows: Rows): Pick<Chain, "all" | "first" | "update"> {
  return {
    all: vi.fn(async () => rows),
    first: vi.fn(async () => rows[0] ?? null),
    update: vi.fn(async () => ({})),
  };
}

function modelStub(rows: Rows) {
  return {
    create: vi.fn(async () => ({})),
    upsert: vi.fn(async () => ({})),
    select: vi.fn(() => selectChain(rows)),
    where: vi.fn(() => whereChain(rows)),
  };
}

export interface MockDb {
  orm: {
    public: {
      Team: ReturnType<typeof modelStub>;
      User: ReturnType<typeof modelStub>;
      Match: ReturnType<typeof modelStub>;
      ClubMembership: ReturnType<typeof modelStub>;
      Coach: ReturnType<typeof modelStub>;
      Committee: ReturnType<typeof modelStub>;
    };
  };
}

export function createMockDb(rowsByModel: Partial<Record<keyof MockDb["orm"]["public"], Rows>> = {}): MockDb {
  return {
    orm: {
      public: {
        Team: modelStub(rowsByModel.Team ?? []),
        User: modelStub(rowsByModel.User ?? []),
        Match: modelStub(rowsByModel.Match ?? []),
        ClubMembership: modelStub(rowsByModel.ClubMembership ?? []),
        Coach: modelStub(rowsByModel.Coach ?? []),
        Committee: modelStub(rowsByModel.Committee ?? []),
      },
    },
  };
}

// Cast the mock to the ORM Db type expected by the sync script helpers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function asDb(mock: MockDb): any {
  return mock;
}