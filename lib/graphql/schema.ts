export const typeDefs = /* GraphQL */ `
  type Query {
    matches(season: String): [Match]!
    members(season: String): [Member!]!
    teams(season: String): [Team!]!
    activeMembers(season: String): [Member!]!
  }

  type Mutation {
    upsertTaskAssignment(assignmentId: ID, taskId: ID!, memberId: ID, season: String!): TaskAssignee!
  }

  type Match {
    id: ID!
    foysMatchId: Int!
    status: MatchStatus!
    date: String!
    startTime: String
    homeScore: Int
    awayScore: Int
    homeTeam: TeamType!
    awayTeam: NbbTeam!
    field: FieldType
    tasks: MatchTasks!
  }

  type TaskAssignee {
    assignmentId: ID!
    taskId: ID!
    status: TaskAssignmentStatus!
    member: Member
  }

  type MatchTasks {
    hallDuty: TaskAssignee
    referee1: TaskAssignee
    referee2: TaskAssignee
    scorer: TaskAssignee
    timer: TaskAssignee
    shotClock: TaskAssignee
  }

  type NbbTeam {
    foysId: Int!
    name: String
    organisation: NbbOrganisation
  }

  type NbbOrganisation {
    name: String!
    foysId: UUID!
  }

  type User {
    id: ID!
    email: String!
    firstName: String
    lastNamePrefix: String
    lastName: String
    nbbNumber: String
    refereeLevel: RefereeLevel
    foysUserId: String
    memberSince: String
  }

  type Member {
    id: ID!
    user: User!
    season: String!
    primaryTeam: TeamType
    coachingTeams: [TeamType!]!
    committees: [CommitteeType!]!
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

  enum RefereeLevel {
    F
    BS2
    E
    BS3
    BS4
  }

  scalar UUID

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

  enum TaskType {
    HALL_DUTY
    REFEREE
    TABLE_SCORER
    TABLE_TIMER
    TABLE_24S_SHOT_CLOCK
  }

  enum TaskAssignmentStatus {
    PLANNED
    DRAFT
  }
`;
