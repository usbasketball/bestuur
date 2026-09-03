import type { CommitteeType, Season, TeamType } from "@/lib/types";
import type { User } from "./user";

export type Member = {
  id: string;
  user: User;
  season: Season;
  primaryTeam: TeamType | null;
  coachingTeams: TeamType[];
  committees: CommitteeType[];
};
