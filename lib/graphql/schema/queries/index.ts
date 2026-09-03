import { builder } from "../builder";
import { db } from "@/lib/db";
import { assertBestuur, requireSession } from "@/lib/api-auth";
import {
  normalizeSeason,
  loadUsers,
  loadMemberContext,
  memberRecord,
  loadUserByAuth0Sub,
} from "../loaders";
import { loadMatchData } from "../load-match-data";
import { MemberRef } from "../types/member";
import { TeamRef, type TeamRecord } from "../types/team";
import { UserRef } from "../types/user";
import { MatchRef } from "../types/match";

builder.queryFields((t) => ({
  matches: t.field({
    type: [MatchRef],
    nullable: { items: true, list: false },
    args: {
      season: t.arg.string({ required: false }),
    },
    resolve: async (_root, { season }, ctx) => {
      await assertBestuur(ctx);
      const s = normalizeSeason(season);
      return loadMatchData(s);
    },
  }),

  members: t.field({
    type: [MemberRef],
    args: {
      season: t.arg.string({ required: false }),
    },
    resolve: async (_root, { season }, ctx) => {
      await assertBestuur(ctx);
      const s = normalizeSeason(season);

      const memberships = await db.orm.public.ClubMembership.select("userId")
        .where((m) => m.season.eq(s))
        .all();
      const memberCtx = await loadMemberContext(s);
      const users = await loadUsers(memberships.map((m) => m.userId));

      return users.map((user) => memberRecord(user, s, memberCtx));
    },
  }),

  activeMembers: t.field({
    type: [MemberRef],
    args: {
      season: t.arg.string({ required: false }),
    },
    resolve: async (_root, { season }, ctx) => {
      await assertBestuur(ctx);
      const s = normalizeSeason(season);

      const [coaches, committees, hallDuties] = await Promise.all([
        db.orm.public.Coach.select("userId").where((c) => c.season.eq(s)).all(),
        db.orm.public.Committee.select("userId").where((c) => c.season.eq(s)).all(),
        db.orm.public.HallDuty.select("userId").where((h) => h.season.eq(s)).all(),
      ]);

      const userIds = [
        ...new Set([
          ...coaches.map((c) => c.userId),
          ...committees.map((c) => c.userId),
          ...hallDuties.map((h) => h.userId),
        ]),
      ];

      const memberCtx = await loadMemberContext(s);
      const users = await loadUsers(userIds);

      return users.map((user) => memberRecord(user, s, memberCtx));
    },
  }),

  teams: t.field({
    type: [TeamRef],
    args: {
      season: t.arg.string({ required: false }),
    },
    resolve: async (_root, { season }, ctx) => {
      await assertBestuur(ctx);
      const s = normalizeSeason(season);

      const teams = await db.orm.public.Team.select(
        "id",
        "foysCompetitionTeamId",
        "foysTeamId",
        "name",
        "season",
        "teamType",
        "discipline",
      )
        .where((t) => t.season.eq(s))
        .orderBy([(t) => t.teamType.asc()])
        .all();

      return teams.map((team): TeamRecord => ({
        id: team.id,
        foysCompetitionTeamId: team.foysCompetitionTeamId,
        foysTeamId: team.foysTeamId,
        name: team.name,
        season: team.season,
        teamType: team.teamType,
        discipline: team.discipline,
      }));
    },
  }),

  me: t.field({
    type: UserRef,
    nullable: true,
    resolve: async (_root, _args, ctx) => {
      const session = await requireSession(ctx);
      const sub = session.user.sub;
      if (!sub) return null;
      return loadUserByAuth0Sub(sub);
    },
  }),
}));
