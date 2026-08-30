import { db } from "@/lib/db";
import { SEASONS, type Season } from "@/lib/types";

type ResolverMap = Record<string, unknown>;

function normalizeSeason(raw: unknown): Season {
  return SEASONS.includes(raw as string) ? (raw as Season) : SEASONS[0];
}

export const resolvers: ResolverMap = {
  Query: {
    tasks: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);

      const homeTeams = await db.orm.public.Team.select(
        "foysCompetitionTeamId",
        "name",
        "teamType",
      )
        .where((t) => t.season.eq(season))
        .all();

      const homeTeamFoysIds = new Set(homeTeams.map((t) => t.foysCompetitionTeamId));
      const homeTeamByFoysId = new Map(
        homeTeams.map((t) => [t.foysCompetitionTeamId, t.name ?? t.teamType] as const),
      );
      const teamNameByTeamType = new Map(
        homeTeams.map((t) => [t.teamType, t.name ?? t.teamType] as const),
      );

      const assignments = await db.orm.public.TaskAssignment.select(
        "id",
        "taskId",
        "userId",
        "nbbNumber",
        "isDouble",
      )
        .include("task", (t) =>
          t
            .select("id", "taskType", "matchId")
            .include("match", (m) =>
              m.select(
                "id",
                "foysMatchId",
                "date",
                "startTime",
                "homeTeamFoysId",
                "awayOrganisationName",
                "awayTeamName",
              ),
            ),
        )
        .include("user", (u) =>
          u
            .select("firstName", "lastNamePrefix", "lastName", "email")
            .include("memberships", (m) => m.select("season", "primaryTeam")),
        )
        .all();

      const rows = assignments.filter((a) =>
        homeTeamFoysIds.has(a.task.match.homeTeamFoysId),
      );

      const byMatch = new Map<
        string,
        {
          match: (typeof rows)[number]["task"]["match"];
          referees: (typeof rows)[number][];
          tableScorer: (typeof rows)[number] | null;
          tableTimer: (typeof rows)[number] | null;
          table24s: (typeof rows)[number] | null;
        }
      >();

      for (const a of rows) {
        const matchId = a.task.match.id;
        let entry = byMatch.get(matchId);
        if (!entry) {
          entry = {
            match: a.task.match,
            referees: [],
            tableScorer: null,
            tableTimer: null,
            table24s: null,
          };
          byMatch.set(matchId, entry);
        }
        switch (a.task.taskType) {
          case "REFEREE":
            entry.referees.push(a);
            break;
          case "TABLE_SCORER":
            if (!entry.tableScorer) entry.tableScorer = a;
            break;
          case "TABLE_TIMER":
            if (!entry.tableTimer) entry.tableTimer = a;
            break;
          case "TABLE_24S_SHOT_CLOCK":
            if (!entry.table24s) entry.table24s = a;
            break;
          default:
            break;
        }
      }

      const entries = [...byMatch.values()].sort(
        (a, b) =>
          a.match.date.toString().localeCompare(b.match.date.toString()) ||
          (a.match.startTime ?? "").localeCompare(b.match.startTime ?? ""),
      );

      const assignee = (a: (typeof rows)[number] | null): string | null => {
        if (!a) return null;
        if (a.user) {
          const firstName = a.user.firstName;
          const membership = a.user.memberships.find((m) => m.season === season);
          const teamLabel = membership?.primaryTeam
            ? teamNameByTeamType.get(membership.primaryTeam)
            : undefined;
          const firstNamePart = firstName?.trim();
          if (firstNamePart) {
            return teamLabel ? `${teamLabel} ${firstNamePart}` : firstNamePart;
          }
        }
        return a.nbbNumber || null;
      };

      return entries.map((e) => ({
        matchId: e.match.id,
        foysMatchId: e.match.foysMatchId,
        matchDate: e.match.date.toPlainDate().toString(),
        matchStartTime: e.match.startTime,
        homeTeam: homeTeamByFoysId.get(e.match.homeTeamFoysId) ?? null,
        awayOrganisationName: e.match.awayOrganisationName,
        awayTeamName: e.match.awayTeamName,
        referees: e.referees.map((r) => ({
          isDouble: r.isDouble,
          name: assignee(r),
        })),
        tableScorer: assignee(e.tableScorer),
        tableTimer: assignee(e.tableTimer),
        table24s: assignee(e.table24s),
      }));
    },

    matches: async (_parent: unknown, args: { season?: string }) => {
      const season = normalizeSeason(args.season);

      const homeTeams = await db.orm.public.Team.select(
        "foysCompetitionTeamId",
        "name",
        "teamType",
      )
        .where((t) => t.season.eq(season))
        .all();

      const homeTeamFoysIds = homeTeams.map((t) => t.foysCompetitionTeamId);

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
        "field",
      )
        .where((m) => m.homeTeamFoysId.in(homeTeamFoysIds))
        .orderBy([(m) => m.date.asc(), (m) => m.startTime.asc()])
        .all();

      return {
        homeTeams: homeTeams.map((t) => ({
          foysCompetitionTeamId: t.foysCompetitionTeamId,
          name: t.name,
          teamType: t.teamType,
        })),
        matches: matches.map((match) => ({
          id: match.id,
          foysMatchId: match.foysMatchId,
          status: match.status,
          date: match.date.toPlainDate().toString(),
          startTime: match.startTime,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          homeTeamFoysId: match.homeTeamFoysId,
          awayTeamFoysId: match.awayTeamFoysId,
          awayTeamName: match.awayTeamName,
          awayOrganisationName: match.awayOrganisationName,
          field: match.field,
        })),
      };
    },

    members: async () => {
      const currentSeason = SEASONS[0];

      const users = await db.orm.public.User.select(
        "id",
        "email",
        "firstName",
        "lastNamePrefix",
        "lastName",
        "nbbNumber",
        "refereeLevel",
        "foysUserId",
        "memberSince",
      )
        .include("memberships", (m) =>
          m.where((x) => x.season.eq(currentSeason)).select("membershipType", "primaryTeam"),
        )
        .include("coaches", (c) =>
          c.where((x) => x.season.eq(currentSeason)).select("team"),
        )
        .orderBy([(u) => u.firstName.asc()])
        .all();

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
        memberships: user.memberships.map((m) => ({
          membershipType: m.membershipType,
          primaryTeam: m.primaryTeam,
        })),
        coaches: user.coaches.map((c) => ({ team: c.team })),
      }));
    },

    teams: async () => {
      const teams = await db.orm.public.Team.select(
        "id",
        "foysCompetitionTeamId",
        "foysTeamId",
        "name",
        "season",
        "teamType",
        "discipline",
      )
        .orderBy([(t) => t.season.desc(), (t) => t.teamType.asc()])
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
        db.orm.public.Coach.select("id", "team", "season")
          .include("user", (u) =>
            u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
          )
          .where((c) => c.season.eq(season))
          .all(),
        db.orm.public.Committee.select("id", "type", "season")
          .include("user", (u) =>
            u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
          )
          .where((c) => c.season.eq(season))
          .all(),
        db.orm.public.HallDuty.select("id", "season")
          .include("user", (u) =>
            u.select("firstName", "lastNamePrefix", "lastName", "nbbNumber"),
          )
          .where((h) => h.season.eq(season))
          .all(),
      ]);

      return {
        coaches: coaches.map((c) => ({ id: c.id, team: c.team, user: c.user })),
        committees: committees.map((c) => ({ id: c.id, type: c.type, user: c.user })),
        hallDuties: hallDuties.map((h) => ({ id: h.id, user: h.user })),
      };
    },
  },
};
