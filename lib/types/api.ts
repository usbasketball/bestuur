import type {
  CommitteeType,
  Discipline,
  FieldType,
  MatchStatus,
  RefereeLevel,
  TaskAssignmentStatus,
  TeamType,
} from "@/lib/types";

export type User = {
  email: string;
  firstName: string | null;
  lastNamePrefix: string | null;
  lastName: string | null;
  nbbNumber: string | null;
  refereeLevel: RefereeLevel | null;
  foysUserId: string | null;
  memberSince: string | null;
};

export type Member = {
  id: string;
  user: User;
  season: string;
  primaryTeam: TeamType | null;
  coachingTeams: TeamType[];
  committees: CommitteeType[];
};

export type MembersResponse = Member[];

export type ActiveMembersResponse = Member[];

export type TeamsResponse = Array<{
  id: string;
  foysCompetitionTeamId: number;
  foysTeamId: number | null;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
}>;

export type MatchTasks = {
  hallDuty: TaskAssignee | null;
  referee1: TaskAssignee | null;
  referee2: TaskAssignee | null;
  scorer: TaskAssignee | null;
  timer: TaskAssignee | null;
  shotClock: TaskAssignee | null;
};

export type TaskAssignee = {
  assignmentId: string;
  taskId: string;
  status: TaskAssignmentStatus;
  member: Member | null;
};

export type Match = {
  id: string;
  foysMatchId: number;
  status: MatchStatus;
  date: string;
  startTime: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homeTeam: TeamType;
  awayTeam: NbbTeam | null;
  field: FieldType | null;
  tasks: MatchTasks;
};

export type MatchesResponse = Match[];

export type NbbTeam = {
  foysId: number;
  name: string | null;
  organisation: NbbOrganisation | null;
};

export type NbbOrganisation = {
  name: string;
  foysId: string;
};