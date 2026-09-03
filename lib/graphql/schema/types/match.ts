import { builder } from "../builder";
import { MatchTasksRef, type MatchTasksRecord } from "./task";
import type { MatchStatus, FieldType, TeamType } from "@/lib/types";
import { MatchStatusEnum, FieldTypeEnum, TeamTypeEnum } from "./enums";

/**
 * NbbOrganisation DTO — a small value object embedded on away teams.
 */
export type NbbOrganisationRecord = {
  name: string;
  foysId: string;
};

export const NbbOrganisationRef = builder.objectRef<NbbOrganisationRecord>("NbbOrganisation");

NbbOrganisationRef.implement({
  description: "An away opponent's organisation",
  fields: (t) => ({
    name: t.exposeString("name"),
    foysId: t.expose("foysId", { type: "UUID" }),
  }),
});

/**
 * NbbTeam DTO — denotes an away team by embedded FOYS data.
 */
export type NbbTeamRecord = {
  foysId: number;
  name: string | null;
  organisation: NbbOrganisationRecord | null;
};

export const NbbTeamRef = builder.objectRef<NbbTeamRecord>("NbbTeam");

NbbTeamRef.implement({
  description: "A team participating in a match (home teams are our own; away teams come from FOYS)",
  fields: (t) => ({
    foysId: t.exposeInt("foysId"),
    name: t.exposeString("name", { nullable: true }),
    organisation: t.field({
      type: NbbOrganisationRef,
      nullable: true,
      resolve: (team) => team.organisation,
    }),
  }),
});

/**
 * Match DTO — composed view-model built from the `matches` table, the `teams`
 * table (via homeTeamFoysId → TeamType), and `task_assignments` (tasks).
 */
export type MatchRecord = {
  id: string;
  foysMatchId: number;
  status: MatchStatus;
  date: string;
  startTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamType | null;
  awayTeam: NbbTeamRecord;
  field: FieldType | null;
  tasks: MatchTasksRecord;
};

export const MatchRef = builder.objectRef<MatchRecord>("Match");

MatchRef.implement({
  description: "A basketball match with embedded home/away team info and task assignments",
  fields: (t) => ({
    id: t.exposeID("id"),
    foysMatchId: t.exposeInt("foysMatchId"),
    status: t.expose("status", { type: MatchStatusEnum }),
    date: t.exposeString("date"),
    startTime: t.exposeString("startTime", { nullable: true }),
    homeScore: t.exposeInt("homeScore", { nullable: true }),
    awayScore: t.exposeInt("awayScore", { nullable: true }),
    homeTeam: t.expose("homeTeam", { type: TeamTypeEnum, nullable: true }),
    awayTeam: t.field({ type: NbbTeamRef, resolve: (match) => match.awayTeam }),
    field: t.expose("field", { type: FieldTypeEnum, nullable: true }),
    tasks: t.field({
      type: MatchTasksRef,
      resolve: (match) => match.tasks,
    }),
  }),
});
