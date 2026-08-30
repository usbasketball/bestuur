import { gql } from "urql";

export const TASKS_QUERY = gql`
  query Tasks($season: String) {
    tasks(season: $season) {
      matchId
      foysMatchId
      matchDate
      matchStartTime
      homeTeam
      awayOrganisationName
      awayTeamName
      referees {
        isDouble
        name
      }
      tableScorer
      tableTimer
      table24s
    }
  }
`;

export const MATCHES_QUERY = gql`
  query Matches($season: String) {
    matches(season: $season) {
      homeTeams {
        foysCompetitionTeamId
        name
        teamType
      }
      matches {
        id
        foysMatchId
        status
        date
        startTime
        homeScore
        awayScore
        homeTeamFoysId
        awayTeamFoysId
        awayTeamName
        awayOrganisationName
        field
      }
    }
  }
`;

export const MEMBERS_QUERY = gql`
  query Members {
    members {
      id
      email
      firstName
      lastNamePrefix
      lastName
      nbbNumber
      refereeLevel
      foysUserId
      memberSince
      memberships {
        membershipType
        primaryTeam
      }
      coaches {
        team
      }
    }
  }
`;

export const TEAMS_QUERY = gql`
  query Teams {
    teams {
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
      coaches {
        id
        team
        user {
          firstName
          lastNamePrefix
          lastName
          nbbNumber
        }
      }
      committees {
        id
        type
        user {
          firstName
          lastNamePrefix
          lastName
          nbbNumber
        }
      }
      hallDuties {
        id
        user {
          firstName
          lastNamePrefix
          lastName
          nbbNumber
        }
      }
    }
  }
`;
