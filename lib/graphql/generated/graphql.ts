/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type CommitteeType =
  | 'BOARD_CHAIRPERSON'
  | 'BOARD_GAME_SECRETARY'
  | 'BOARD_GENERAL_MEMBER'
  | 'BOARD_SECRETARY'
  | 'BOARD_TREASURER'
  | 'OMNI';

export type Discipline =
  | 'DISCIPLINE_3x3'
  | 'DISCIPLINE_5x5';

export type FieldType =
  | 'CENTER_COURT'
  | 'VELD_1'
  | 'VELD_2'
  | 'VELD_3';

export type MatchStatus =
  | 'CANCELLED'
  | 'FINAL'
  | 'PLANNED'
  | 'WITHDRAWN';

export type RefereeLevel =
  | 'BS2'
  | 'BS3'
  | 'BS4'
  | 'E'
  | 'F';

export type TaskAssignmentStatus =
  | 'DRAFT'
  | 'PLANNED';

export type TeamType =
  | 'MSE1'
  | 'MSE2'
  | 'MSE3'
  | 'MSE4'
  | 'MSE5'
  | 'MSE6'
  | 'V3x3'
  | 'VSE1'
  | 'VSE2'
  | 'VSE3'
  | 'VSE4'
  | 'VSE5'
  | 'VSE6';

export type MatchesQueryVariables = Exact<{
  season?: string | null | undefined;
}>;


export type MatchesQuery = { matches: Array<{ id: string, foysMatchId: number, status: MatchStatus, date: string, startTime: string | null, homeScore: number | null, awayScore: number | null, homeTeam: TeamType | null, field: FieldType | null, awayTeam: { foysId: number, name: string | null, organisation: { name: string, foysId: unknown } | null }, tasks: { hallDuty: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null, referee1: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null, referee2: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null, scorer: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null, timer: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null, shotClock: { assignmentId: string, taskId: string, status: TaskAssignmentStatus, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null } } | null> };

export type MembersQueryVariables = Exact<{
  season?: string | null | undefined;
}>;


export type MembersQuery = { members: Array<{ id: string, season: string, primaryTeam: TeamType | null, coachingTeams: Array<TeamType>, committees: Array<CommitteeType>, user: { email: string, firstName: string | null, lastNamePrefix: string | null, lastName: string | null, nbbNumber: string | null, refereeLevel: RefereeLevel | null, foysUserId: string | null, memberSince: string | null } }> };

export type TeamsQueryVariables = Exact<{
  season?: string | null | undefined;
}>;


export type TeamsQuery = { teams: Array<{ id: string, foysCompetitionTeamId: number, foysTeamId: number | null, name: string | null, season: string, teamType: TeamType, discipline: Discipline }> };

export type ActiveMembersQueryVariables = Exact<{
  season?: string | null | undefined;
}>;


export type ActiveMembersQuery = { activeMembers: Array<{ id: string, season: string, primaryTeam: TeamType | null, coachingTeams: Array<TeamType>, committees: Array<CommitteeType>, user: { email: string, firstName: string | null, lastNamePrefix: string | null, lastName: string | null, nbbNumber: string | null, refereeLevel: RefereeLevel | null, foysUserId: string | null, memberSince: string | null } }> };

export type UpsertTaskAssignmentMutationVariables = Exact<{
  assignmentId?: string | null | undefined;
  taskId: string;
  memberId?: string | null | undefined;
  season: string;
}>;


export type UpsertTaskAssignmentMutation = { upsertTaskAssignment: { assignmentId: string, member: { id: string, primaryTeam: TeamType | null, user: { firstName: string | null, lastNamePrefix: string | null, lastName: string | null } } | null } | null };


export const MatchesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Matches"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"matches"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"foysMatchId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}},{"kind":"Field","name":{"kind":"Name","value":"homeScore"}},{"kind":"Field","name":{"kind":"Name","value":"awayScore"}},{"kind":"Field","name":{"kind":"Name","value":"homeTeam"}},{"kind":"Field","name":{"kind":"Name","value":"awayTeam"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"foysId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"organisation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"foysId"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"field"}},{"kind":"Field","name":{"kind":"Name","value":"tasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"hallDuty"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"referee1"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"referee2"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"scorer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"timer"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"shotClock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<MatchesQuery, MatchesQueryVariables>;
export const MembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Members"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"members"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"season"}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}},{"kind":"Field","name":{"kind":"Name","value":"coachingTeams"}},{"kind":"Field","name":{"kind":"Name","value":"committees"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"nbbNumber"}},{"kind":"Field","name":{"kind":"Name","value":"refereeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"foysUserId"}},{"kind":"Field","name":{"kind":"Name","value":"memberSince"}}]}}]}}]}}]} as unknown as DocumentNode<MembersQuery, MembersQueryVariables>;
export const TeamsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Teams"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"teams"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"foysCompetitionTeamId"}},{"kind":"Field","name":{"kind":"Name","value":"foysTeamId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"season"}},{"kind":"Field","name":{"kind":"Name","value":"teamType"}},{"kind":"Field","name":{"kind":"Name","value":"discipline"}}]}}]}}]} as unknown as DocumentNode<TeamsQuery, TeamsQueryVariables>;
export const ActiveMembersDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ActiveMembers"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activeMembers"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"season"}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}},{"kind":"Field","name":{"kind":"Name","value":"coachingTeams"}},{"kind":"Field","name":{"kind":"Name","value":"committees"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}},{"kind":"Field","name":{"kind":"Name","value":"nbbNumber"}},{"kind":"Field","name":{"kind":"Name","value":"refereeLevel"}},{"kind":"Field","name":{"kind":"Name","value":"foysUserId"}},{"kind":"Field","name":{"kind":"Name","value":"memberSince"}}]}}]}}]}}]} as unknown as DocumentNode<ActiveMembersQuery, ActiveMembersQueryVariables>;
export const UpsertTaskAssignmentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpsertTaskAssignment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"assignmentId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"memberId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"season"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upsertTaskAssignment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"assignmentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"assignmentId"}}},{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"memberId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"memberId"}}},{"kind":"Argument","name":{"kind":"Name","value":"season"},"value":{"kind":"Variable","name":{"kind":"Name","value":"season"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"assignmentId"}},{"kind":"Field","name":{"kind":"Name","value":"member"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"user"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"firstName"}},{"kind":"Field","name":{"kind":"Name","value":"lastNamePrefix"}},{"kind":"Field","name":{"kind":"Name","value":"lastName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"primaryTeam"}}]}}]}}]}}]} as unknown as DocumentNode<UpsertTaskAssignmentMutation, UpsertTaskAssignmentMutationVariables>;