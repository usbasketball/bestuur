import { GraphQLScalarType, Kind } from "graphql";
import { db } from "@/lib/db";
import { SEASONS, type Season, type TeamType, type CommitteeType } from "@/lib/types";

type ResolverMap = Record<string, unknown>;

const UUID = new GraphQLScalarType({
  name: "UUID",
  description: "A universally unique identifier (UUID) string",
  serialize: (value) => value as string,
  parseValue: (value) => value as string,
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) return ast.value;
    return null;
  },
});

function normalizeSeason(raw: unknown): Season {
  return SEASONS.includes(raw as string) ? (raw as Season) : SEASONS[0];
}

type UserRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  refereeLevel: string | null;
  foysUserId: string | null;
  memberSince: string | null;
};

type MemberRecord = {
  id: string;
  user: UserRecord;
  season: Season;
  primaryTeam: TeamType | null;
  coachingTeams: TeamType[];
  committees: CommitteeType[];
};

type MemberContext = {
  primaryTeamByUser: Map<string, TeamType>;
  coachingByUser: Map<string, TeamType[]>;
  committeesByUser: Map<string, CommitteeType[]>;
};

async function loadUsers(userIds?: string[]): Promise<UserRecord[]> {
  const base = db.orm.public.User.select(
    "id",
    "email",
    "firstName",
    "lastNamePrefix",
    "lastName",
    "nbbNumber",
    "refereeLevel",
    "foysUserId",
    "memberSince",
  );

  const users =
    userIds && userIds.length > 0
      ? await base
          .where((u) => u.id.in([...userIds]))
          .orderBy([(u) => u.firstName.asc()])
          .all()
      : await base.orderBy([(u) => u.firstName.asc()]).all();

  return users.map((user) => ({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastNamePrefix: user.lastNamePrefix,
    lastName: user.lastName,
    nbbNumber: user.nbbNumber,
    refereeLevel: user.refereeLevel,
    foysUserId: user.foysUserId,
    memberSince: user.memberSince?.toPlainDate().toString() ?? null,
  }));
}

async function loadMemberContext(season: Season): Promise<MemberContext> {
  const [memberships, coaches, committees] = await Promise.all([
    db.orm.public.ClubMembership.select("userId", "primaryTeam")
      .where((m) => m.season.eq(season))
      .all(),
    db.orm.public.Coach.select("userId", "team")
      .where((c) => c.season.eq(season))
      .all(),
    db.orm.public.Committee.select("userId", "type")
      .where((c) => c.season.eq(season))
      .all(),
  ]);

  const primaryTeamByUser = new Map<string, TeamType>();
  for (const m of memberships) {
    if (m.primaryTeam) primaryTeamByUser.set(m.userId, m.primaryTeam);
  }
  const coachingByUser = new Map<string, TeamType[]>();
  for (const c of coaches) {
    coachingByUser.set(c.userId, [...(coachingByUser.get(c.userId) ?? []), c.team]);
  }
  const committeesByUser = new Map<string, CommitteeType[]>();
  for (const c of committees) {
    committeesByUser.set(c.userId, [...(committeesByUser.get(c.userId) ?? []), c.type]);
  }

  return { primaryTeamByUser, coachingByUser, committeesByUser };
}

function memberRecord(user: UserRecord, season: Season, ctx: MemberContext): MemberRecord {
  return {
    id: user.id,
    user,
    season,
    primaryTeam: ctx.primaryTeamByUser.get(user.id) ?? null,
    coachingTeams: ctx.coachingByUser.get(user.id) ?? [],
    committees: ctx.committeesByUser.get(user.id) ?? [],
  };
}

function buildUser(user: {
  id: string;
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  refereeLevel: string | null;
  foysUserId: string | null;
  memberSince: unknown;
}): UserRecord {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastNamePrefix: user.lastNamePrefix,
    lastName: user.lastName,
    nbbNumber: user.nbbNumber,
    refereeLevel: user.refereeLevel,
    foysUserId: user.foysUserId,
    memberSince:
      user.memberSince && typeof user.memberSince === "object" &&
      "toPlainDate" in user.memberSince
        ? (user.memberSince as { toPlainDate: () => { toString(): string } }).toPlainDate().toString()
        : null,
  };
}

type MatchRow = {
  id: string;
  foysMatchId: number;
  status: string;
  date: { toPlainDate(): { toString(): string } };
  startTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeamFoysId: number;
  awayTeamFoysId: number | null;
  awayTeamName: string | null;
  awayOrganisationName: string | null;
  awayOrganisationId: string | null;
  field: string | null;
};

function buildMatch(match: MatchRow, homeTeamTypeByFoysId: Map<number, string | null>) {
  return {
    id: match.id,
    foysMatchId: match.foysMatchId,
    status: match.status,
    date: match.date.toPlainDate().toString(),
    startTime: match.startTime,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    homeTeam: homeTeamTypeByFoysId.get(match.homeTeamFoysId) ?? null,
    awayTeam: {
      foysId: match.awayTeamFoysId ?? 0,
      name: match.awayTeamName,
      organisation: match.awayOrganisationId
        ? {
            name: match.awayOrganisationName ?? "",
            foysId: match.awayOrganisationId,
          }
        : null,
    },
    field: match.field,
    tasks: { referee1: null, referee2: null, scorer: null, timer: null, shotClock: null },
  };
}

async function loadMatchData(season: Season) {
  const homeTeams = await db.orm.public.Team.select(
    "foysCompetitionTeamId",
    "name",
    "teamType",
  )
    .where((t) => t.season.eq(season))
    .all();

  const homeTeamFoysIds = new Set(homeTeams.map((t) => t.foysCompetitionTeamId));
  const homeTeamTypeByFoysId = new Map(
    homeTeams.map((t) => [t.foysCompetitionTeamId, t.teamType] as const),
  );

  const matches = await db.orm.public.Match.select(
    "id",
    "foysMatchId",
    "status",
    "date",
    "startTime",
    "homeScore",
    "awayScore",
    "homeTeamFoysId",
    "awayTeamFoysId",
    "awayTeamName",
    "awayOrganisationName",
    "awayOrganisationId",
    "field",
  )
    .where((m) => m.homeTeamFoysId.in([...homeTeamFoysIds]))
    .where((m) => m.status.neq("WITHDRAWN"))
    .orderBy([(m) => m.date.asc(), (m) => m.startTime.asc(), (m) => m.field.asc()])
    .all();

  const matchObjById = new Map<string, Record<string, unknown>>();
  for (const m of matches) {
    matchObjById.set(m.id, buildMatch(m, homeTeamTypeByFoysId) as Record<string, unknown>);
  }

  const assignments = await db.orm.public.TaskAssignment.select(
    "id",
    "taskId",
    "userId",
    "nbbNumber",
    "isDouble",
    "status",
  )
    .include("task", (t) => t.select("id", "taskType", "matchId"))
    .include("user", (u) =>
      u.select(
        "id",
        "email",
        "firstName",
        "lastNamePrefix",
        "lastName",
        "nbbNumber",
        "refereeLevel",
        "foysUserId",
        "memberSince",
      ),
    )
    .all();

  const memberCtx = await loadMemberContext(season);

  const taskRows = assignments
    .filter((a) => matchObjById.has(a.task.matchId))
    .map((a) => ({
      taskMatchId: a.task.matchId,
      taskType: a.task.taskType,
      taskId: a.taskId,
      assignment: a.user
        ? { assignmentId: a.id, taskId: a.taskId, status: a.status, member: memberRecord(buildUser(a.user), season, memberCtx) }
        : { assignmentId: a.id, taskId: a.taskId, status: a.status, member: null },
    }));

  for (const t of taskRows) {
    const m = matchObjById.get(t.taskMatchId);
    if (!m) continue;
    const tasks = m.tasks as { referee1: unknown; referee2: unknown; scorer: unknown; timer: unknown; shotClock: unknown };
    if (t.taskType === "REFEREE") {
      if (!tasks.referee1) tasks.referee1 = t.assignment;
      else if (!tasks.referee2) tasks.referee2 = t.assignment;
    } else if (t.taskType === "TABLE_SCORER") {
      tasks.scorer = t.assignment;
    } else if (t.taskType === "TABLE_TIMER") {
      tasks.timer = t.assignment;
    } else if (t.taskType === "TABLE_24S_SHOT_CLOCK") {
      tasks.shotClock = t.assignment;
    }
  }

  const matchesArr = [...matchObjById.values()];
  return { matches: matchesArr };
}

export const resolvers: ResolverMap = {
  UUID,
  TaskAssignee: {
    member: (parent: { assignmentId: string; member: unknown }) => parent.member,
  },
  Query: {
    matches: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);
      const { matches } = await loadMatchData(season);
      return matches;
    },

    members: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);

      const memberships = await db.orm.public.ClubMembership.select("userId")
        .where((m) => m.season.eq(season))
        .all();
      const ctx = await loadMemberContext(season);
      const users = await loadUsers(memberships.map((m) => m.userId));

      return users.map((user) => memberRecord(user, season, ctx));
    },

    teams: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);

      const teams = await db.orm.public.Team.select(
        "id",
        "foysCompetitionTeamId",
        "foysTeamId",
        "name",
        "season",
        "teamType",
        "discipline",
      )
        .where((t) => t.season.eq(season))
        .orderBy([(t) => t.teamType.asc()])
        .all();

      return teams.map((team) => ({
        id: team.id,
        foysCompetitionTeamId: team.foysCompetitionTeamId,
        foysTeamId: team.foysTeamId,
        name: team.name,
        season: team.season,
        teamType: team.teamType,
        discipline: team.discipline,
      }));
    },

    activeMembers: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);

      const [coaches, committees, hallDuties] = await Promise.all([
        db.orm.public.Coach.select("userId")
          .where((c) => c.season.eq(season))
          .all(),
        db.orm.public.Committee.select("userId")
          .where((c) => c.season.eq(season))
          .all(),
        db.orm.public.HallDuty.select("userId")
          .where((h) => h.season.eq(season))
          .all(),
      ]);

      const userIds = [
        ...new Set([
          ...coaches.map((c) => c.userId),
          ...committees.map((c) => c.userId),
          ...hallDuties.map((h) => h.userId),
        ]),
      ];

      const ctx = await loadMemberContext(season);
      const users = await loadUsers(userIds);

      return users.map((user) => memberRecord(user, season, ctx));
    },
  },

  Mutation: {
    upsertTaskAssignment: async (
      _parent: unknown,
      args: { assignmentId?: string | null; taskId: string; memberId?: string | null; season: string },
    ) => {
      const { assignmentId, taskId, memberId } = args;
      const season = normalizeSeason(args.season);

      const assignment = assignmentId
        ? await db.orm.public.TaskAssignment.where((a) => a.id.eq(assignmentId)).first()
        : null;

      if (assignmentId && !assignment) {
        throw new Error("Assignment not found");
      }

      if (assignment && assignment.status !== "DRAFT") {
        throw new Error("Assignment is not in DRAFT status");
      }

      const task = await db.orm.public.Task.where((t) => t.id.eq(taskId)).first();
      if (!task) throw new Error("Task not found");

      const newUserId = memberId ?? null;

      // Delete conflicting assignment if the new user is already assigned to a different task
      if (newUserId) {
        const existingForUser = await db.orm.public.TaskAssignment.where(
          (a) => a.taskId.neq(taskId),
        ).where((a) => a.userId.eq(newUserId)).first();
        if (existingForUser) {
          await db.orm.public.TaskAssignment.where((a) => a.id.eq(existingForUser.id)).deleteAndCount();
        }
      }

      if (assignment) {
        // Update existing assignment: remove any other assignment on this task first
        const existingOnTask = await db.orm.public.TaskAssignment.where(
          (a) => a.taskId.eq(taskId),
        ).where((a) => a.id.neq(assignment.id)).first();
        if (existingOnTask) {
          await db.orm.public.TaskAssignment.where((a) => a.id.eq(existingOnTask.id)).deleteAndCount();
        }
        await db.orm.public.TaskAssignment.where((a) => a.id.eq(assignment.id)).update({
          userId: newUserId,
          nbbNumber: null,
        });
      } else {
        // Create new assignment
        await db.orm.public.TaskAssignment.create({
          taskId,
          userId: newUserId,
          nbbNumber: null,
          isDouble: false,
          status: "DRAFT",
        });
      }

      // Fetch updated assignment with user
      const updated = await db.orm.public.TaskAssignment.where(
        (a) => a.taskId.eq(taskId),
      ).first();

      if (!updated) throw new Error("Failed to upsert assignment");

      const memberCtx = await loadMemberContext(season);
      let member = null;
      if (updated.userId) {
        const users = await loadUsers([updated.userId]);
        if (users[0]) member = memberRecord(users[0], season, memberCtx);
      }

      return { assignmentId: updated.id, taskId, status: updated.status, member };
    },
  },
};
