import type {
  CommitteeType,
  Discipline,
  FieldType,
  MatchStatus,
  RefereeLevel,
  Season,
  TaskAssignmentStatus,
  TeamType,
} from "@/lib/types";

export type User = {
  id: string;
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
  season: Season;
  primaryTeam: TeamType | null;
  coachingTeams: TeamType[];
  committees: CommitteeType[];
};

export type Team = {
  id: string;
  foysCompetitionTeamId: number;
  foysTeamId: number | null;
  name: string | null;
  season: string;
  teamType: TeamType;
  discipline: Discipline;
};

export type Organisation = {
  name: string;
  foysId: string;
};

export type AwayTeam = {
  foysId: number;
  name: string | null;
  organisation: Organisation | null;
};

export type TaskAssignee = {
  assignmentId: string;
  taskId: string;
  status: TaskAssignmentStatus;
  member: Member | null;
};

export type MatchTasks = {
  hallDuty: TaskAssignee | null;
  referee1: TaskAssignee | null;
  referee2: TaskAssignee | null;
  scorer: TaskAssignee | null;
  timer: TaskAssignee | null;
  shotClock: TaskAssignee | null;
};

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
