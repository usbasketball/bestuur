import type {
  ClubMembershipType,
  CommitteeType,
  Discipline,
  FieldType,
  MatchStatus,
  TeamType,
} from "@/lib/types";

export type MemberMembership = {
  membershipType: ClubMembershipType;
  primaryTeam: TeamType | null;
};

export type MemberCoach = {
  team: TeamType;
};

export type MembersResponse = Array<{
  id: string;
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  refereeLevel: string | null;
  foysUserId: string | null;
  memberSince: string | null;
  memberships: MemberMembership[];
  coaches: MemberCoach[];
}>;

export type ActiveMemberUser = {
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
};

export type ActiveMembersResponse = {
  coaches: Array<{ id: string; team: TeamType | null; user: ActiveMemberUser }>;
  committees: Array<{ id: string; type: CommitteeType; user: ActiveMemberUser }>;
  hallDuties: Array<{ id: string; user: ActiveMemberUser }>;
};

export type TeamsResponse = Array<{
  id: string;
  foysCompetitionTeamId: number;
  foysTeamId: number | null;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
}>;

export type TasksResponse = Array<{
  matchId: string;
  foysMatchId: number;
  matchDate: string;
  matchStartTime: string | null;
  homeTeam: string | null;
  awayOrganisationName: string | null;
  awayTeamName: string | null;
  referees: Array<{
    isDouble: boolean;
    name: string | null;
  }>;
  tableScorer: string | null;
  tableTimer: string | null;
  table24s: string | null;
}>;

export type MatchesResponse = {
  homeTeams: Array<{
    foysCompetitionTeamId: number;
    name: string | null;
    teamType: TeamType;
  }>;
  matches: Array<{
    id: string;
    foysMatchId: number;
    status: MatchStatus;
    date: string;
    startTime: string | null;
    homeScore: number | null;
    awayScore: number | null;
    homeTeamFoysId: number;
    awayTeamFoysId: number;
    awayTeamName: string | null;
    awayOrganisationName: string | null;
    field: FieldType | null;
  }>;
};