import { builder } from "../builder";
import type { TeamType, Discipline } from "@/lib/types";
import { TeamTypeEnum, DisciplineEnum } from "./enums";

/**
 * Team DTO — maps 1:1 to the `teams` table (selected fields).
 */
export type TeamGql = {
  id: string;
  foysCompetitionTeamId: number;
  foysTeamId: number | null;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
};

export const TeamRef = builder.objectRef<TeamGql>("Team");

TeamRef.implement({
  description: "A team, mapped 1:1 from the teams table",
  fields: (t) => ({
    id: t.exposeID("id"),
    foysCompetitionTeamId: t.exposeInt("foysCompetitionTeamId"),
    foysTeamId: t.exposeInt("foysTeamId", { nullable: true }),
    name: t.exposeString("name", { nullable: true }),
    season: t.exposeString("season"),
    teamType: t.expose("teamType", { type: TeamTypeEnum }),
    discipline: t.expose("discipline", { type: DisciplineEnum }),
  }),
});
