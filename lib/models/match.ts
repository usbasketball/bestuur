import type { FieldType, MatchStatus, TeamType } from "@/lib/types";
import type { AwayTeam } from "./away-team";
import type { MatchTasks } from "./match-tasks";

export type Match = {
  id: string;
  foysMatchId: number;
  status: MatchStatus;
  date: string;
  startTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamType | null;
  awayTeam: AwayTeam;
  field: FieldType | null;
  tasks: MatchTasks;
};
