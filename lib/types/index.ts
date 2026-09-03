export { REFEREE_LEVELS, TAG_CODE_TO_LEVEL, type RefereeLevel } from "./referee-level";
export { TEAM_TYPES, mapTeamType, abbreviateTeamType, type TeamType } from "./team-type";
export { DISCIPLINES, formatDiscipline, type Discipline } from "./discipline";
export { FIELD_TYPES, mapFieldType, formatFieldType, type FieldType } from "./field-type";
export { MATCH_STATUSES, mapMatchStatus, type MatchStatus } from "./match-status";
export { CLUB_MEMBERSHIP_TYPES, mapClubMembershipType, mapPlanMembershipType, type ClubMembershipType } from "./club-membership-type";
export { COMMITTEE_TYPES, type CommitteeType } from "./committee-type";
export { TASK_TYPES, type TaskType } from "./task-type";
export { TASK_ASSIGNMENT_STATUSES, type TaskAssignmentStatus } from "./task-assignment-status";
export { FOYS_CLUB_ID, FOYS_BASE_URL, foysMemberUrl, foysTeamUrl, foysMatchUrl } from "./foys";
export { SEASONS, seasonFromDate, type Season } from "./seasons";
export { toPlainDateTime, toPlainDateTimeFromIso } from "./datetime";

// Re-export GQL response types for backward compatibility with component imports.
// These match the Pothos schema types; will be replaced by codegen-generated types.
export type { UserRecord as User } from "@/lib/graphql/schema/types/user";
export type { MemberRecord as Member } from "@/lib/graphql/schema/types/member";
export type { MatchRecord as Match } from "@/lib/graphql/schema/types/match";
export type { TaskAssigneeRecord as TaskAssignee } from "@/lib/graphql/schema/types/task";
export type { MatchTasksRecord as MatchTasks } from "@/lib/graphql/schema/types/task";
export type { NbbTeamRecord as NbbTeam } from "@/lib/graphql/schema/types/match";
export type { NbbOrganisationRecord as NbbOrganisation } from "@/lib/graphql/schema/types/match";
export type { TeamRecord as Team } from "@/lib/graphql/schema/types/team";

export type MatchesResponse = import("@/lib/graphql/schema/types/match").MatchRecord[];
export type MembersResponse = import("@/lib/graphql/schema/types/member").MemberRecord[];
export type ActiveMembersResponse = import("@/lib/graphql/schema/types/member").MemberRecord[];
export type TeamsResponse = import("@/lib/graphql/schema/types/team").TeamRecord[];
