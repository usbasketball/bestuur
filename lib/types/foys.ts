export const FOYS_CLUB_ID = "2f1e5e8e-e2c5-4d8b-9d21-1584bc6c8d5a";

export const FOYS_BASE_URL = `https://club.basketball.nl/management/${FOYS_CLUB_ID}`;

export function foysMemberUrl(foysUserId: string): string {
  return `${FOYS_BASE_URL}/management/person/${foysUserId}`;
}

export function foysTeamUrl(foysTeamId: number): string {
  return `${FOYS_BASE_URL}/spas/competition/teams/${foysTeamId}/details`;
}

export function foysMatchUrl(foysMatchId: number): string {
  return `${FOYS_BASE_URL}/spas/competition/matches/${foysMatchId}`;
}
