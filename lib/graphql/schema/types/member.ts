import { builder } from "../builder";
import type { TeamType, CommitteeType, Season } from "@/lib/types";
import type { UserRecord } from "./user";
import { UserRef } from "./user";
import { TeamTypeEnum, CommitteeTypeEnum } from "./enums";

/**
 * Member DTO — a composed view-model aggregating data from `users`,
 * `club_memberships`, `coaches` and `committees`. There is no `members` table;
 * members are users with a club membership for a given season.
 */
export type MemberRecord = {
  id: string;
  user: UserRecord;
  season: Season;
  primaryTeam: TeamType | null;
  coachingTeams: TeamType[];
  committees: CommitteeType[];
};

export const MemberRef = builder.objectRef<MemberRecord>("Member");

MemberRef.implement({
  description: "A club member for a given season",
  fields: (t) => ({
    id: t.exposeID("id"),
    user: t.field({ type: UserRef, resolve: (member) => member.user }),
    season: t.exposeString("season"),
    primaryTeam: t.expose("primaryTeam", { type: TeamTypeEnum, nullable: true }),
    coachingTeams: t.field({
      type: [TeamTypeEnum],
      resolve: (member) => member.coachingTeams,
    }),
    committees: t.field({
      type: [CommitteeTypeEnum],
      resolve: (member) => member.committees,
    }),
  }),
});
