import {
  TEAM_TYPES,
  REFEREE_LEVELS,
  DISCIPLINES,
  MATCH_STATUSES,
  FIELD_TYPES,
  CLUB_MEMBERSHIP_TYPES,
  COMMITTEE_TYPES,
  TASK_TYPES,
  TASK_ASSIGNMENT_STATUSES,
} from "@/lib/types";
import { builder } from "../builder";

const enumValues = <T extends readonly string[]>(values: T): Record<string, { value: T[number] }> =>
  Object.fromEntries(values.map((v) => [v, { value: v }]));

export const TeamTypeEnum = builder.enumType("TeamType", { values: enumValues(TEAM_TYPES) });
export const RefereeLevelEnum = builder.enumType("RefereeLevel", { values: enumValues(REFEREE_LEVELS) });
export const DisciplineEnum = builder.enumType("Discipline", { values: enumValues(DISCIPLINES) });
export const MatchStatusEnum = builder.enumType("MatchStatus", { values: enumValues(MATCH_STATUSES) });
export const FieldTypeEnum = builder.enumType("FieldType", { values: enumValues(FIELD_TYPES) });
export const ClubMembershipTypeEnum = builder.enumType("ClubMembershipType", { values: enumValues(CLUB_MEMBERSHIP_TYPES) });
export const CommitteeTypeEnum = builder.enumType("CommitteeType", { values: enumValues(COMMITTEE_TYPES) });
export const TaskTypeEnum = builder.enumType("TaskType", { values: enumValues(TASK_TYPES) });
export const TaskAssignmentStatusEnum = builder.enumType("TaskAssignmentStatus", { values: enumValues(TASK_ASSIGNMENT_STATUSES) });
