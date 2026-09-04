import type { Discipline, TeamType } from "@/lib/types";

export type Team = {
  id: string;
  foysCompetitionTeamId: number;
  foysTeamId: number | null;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
};
