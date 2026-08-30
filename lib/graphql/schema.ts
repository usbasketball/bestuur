export const typeDefs = /* GraphQL */ `
  type Query {
    tasks(season: String): [TaskScheduleMatch!]!
    matches(season: String): Matches!
    members: [Member!]!
    teams: [Team!]!
    activeMembers(season: String): ActiveMembers!
  }

  type TaskScheduleMatch {
    matchId: ID!
    foysMatchId: Int!
    matchDate: String!
    matchStartTime: String
    homeTeam: String
    awayOrganisationName: String
    awayTeamName: String
    referees: [TaskReferee!]!
    tableScorer: String
    tableTimer: String
    table24s: String
  }

  type TaskReferee {
    isDouble: Boolean!
    name: String
  }

  type Matches {
    homeTeams: [HomeTeam!]!
    matches: [Match!]!
  }

  type HomeTeam {
    foysCompetitionTeamId: Int!
    name: String
    teamType: TeamType!
  }

  type Match {
    id: ID!
    foysMatchId: Int!
    status: MatchStatus!
    date: String!
    startTime: String
    homeScore: Int
    awayScore: Int
    homeTeamFoysId: Int!
    awayTeamFoysId: Int!
    awayTeamName: String
    awayOrganisationName: String
    field: FieldType
  }

  type Member {
    id: ID!
    email: String!
    firstName: String
    lastNamePrefix: String
    lastName: String
    nbbNumber: String
    refereeLevel: String
    foysUserId: String
    memberSince: String
    memberships: [MemberMembership!]!
    coaches: [MemberCoach!]!
  }

  type MemberMembership {
    membershipType: ClubMembershipType!
    primaryTeam: TeamType
  }

  type MemberCoach {
    team: TeamType!
  }

  type Team {
    id: ID!
    foysCompetitionTeamId: Int!
    foysTeamId: Int
    name: String
    season: String!
    teamType: TeamType!
    discipline: Discipline!
  }

  type ActiveMembers {
    coaches: [ActiveCoach!]!
    committees: [ActiveCommittee!]!
    hallDuties: [ActiveHallDuty!]!
  }

  type ActiveCoach {
    id: ID!
    team: TeamType
    user: ActiveMemberUser!
  }

  type ActiveCommittee {
    id: ID!
    type: CommitteeType!
    user: ActiveMemberUser!
  }

  type ActiveHallDuty {
    id: ID!
    user: ActiveMemberUser!
  }

  type ActiveMemberUser {
    firstName: String
    lastNamePrefix: String
    lastName: String
    nbbNumber: String
  }

  enum TeamType {
    VSE1
    VSE2
    VSE3
    VSE4
    VSE5
    VSE6
    MSE1
    MSE2
    MSE3
    MSE4
    MSE5
    MSE6
    V3x3
  }

  enum Discipline {
    DISCIPLINE_5x5
    DISCIPLINE_3x3
  }

  enum MatchStatus {
    CANCELLED
    FINAL
    PLANNED
    WITHDRAWN
  }

  enum FieldType {
    CENTER_COURT
    VELD_1
    VELD_2
    VELD_3
  }

  enum ClubMembershipType {
    COMPETITION
    RECREATIONAL
  }

  enum CommitteeType {
    BOARD_CHAIRPERSON
    BOARD_SECRETARY
    BOARD_TREASURER
    BOARD_GAME_SECRETARY
    BOARD_GENERAL_MEMBER
    OMNI
  }
`;
