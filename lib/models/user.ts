import type { RefereeLevel } from "../types";

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