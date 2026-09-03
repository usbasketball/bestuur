import type { Organisation } from "./organisation";

export type AwayTeam = {
  foysId: number;
  name: string | null;
  organisation: Organisation | null;
};
