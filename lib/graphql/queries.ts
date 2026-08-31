import { gql } from "urql";

export const MATCHES_QUERY = gql`
  query Matches($season: String) {
    matches(season: $season) {
      id
      foysMatchId
      status
      date
      startTime
      homeScore
      awayScore
      homeTeam
      awayTeam { foysId name organisation { name foysId } }
      field
      tasks {
        referee1 { assignmentId taskId status member { id user { firstName lastNamePrefix lastName } primaryTeam } }
        referee2 { assignmentId taskId status member { id user { firstName lastNamePrefix lastName } primaryTeam } }
        scorer { assignmentId taskId status member { id user { firstName lastNamePrefix lastName } primaryTeam } }
        timer { assignmentId taskId status member { id user { firstName lastNamePrefix lastName } primaryTeam } }
        shotClock { assignmentId taskId status member { id user { firstName lastNamePrefix lastName } primaryTeam } }
      }
    }
  }
`;

export const MEMBERS_QUERY = gql`
  query Members($season: String) {
    members(season: $season) {
      id
      season
      primaryTeam
      coachingTeams
      committees
      user {
        email
        firstName
        lastNamePrefix
        lastName
        nbbNumber
        refereeLevel
        foysUserId
        memberSince
      }
    }
  }
`;

export const TEAMS_QUERY = gql`
  query Teams($season: String) {
    teams(season: $season) {
      id
      foysCompetitionTeamId
      foysTeamId
      name
      season
      teamType
      discipline
    }
  }
`;

export const ACTIVE_MEMBERS_QUERY = gql`
  query ActiveMembers($season: String) {
    activeMembers(season: $season) {
      id
      season
      primaryTeam
      coachingTeams
      committees
      user {
        email
        firstName
        lastNamePrefix
        lastName
        nbbNumber
        refereeLevel
        foysUserId
        memberSince
      }
    }
  }
`;

export const UPSERT_TASK_ASSIGNMENT_MUTATION = gql`
  mutation UpsertTaskAssignment($assignmentId: ID, $taskId: ID!, $memberId: ID, $season: String!) {
    upsertTaskAssignment(assignmentId: $assignmentId, taskId: $taskId, memberId: $memberId, season: $season) {
      assignmentId
      member {
        id
        user { firstName lastNamePrefix lastName }
        primaryTeam
      }
    }
  }
`;
