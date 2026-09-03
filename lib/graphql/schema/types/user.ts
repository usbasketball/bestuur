import { builder } from "../builder";
import { RefereeLevelEnum } from "./enums";
import type { RefereeLevel } from "@/lib/types";

/**
 * GraphQL parent shape for User. This is intentionally separate from the
 * persistence and domain models.
 * Produced by `loadUsers()` / `buildUser()`. Maps 1:1 to the `users` table,
 * except `memberSince` is already converted from Temporal to an ISO date string.
 */
export type UserGql = {
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

export const UserRef = builder.objectRef<UserGql>("User");

UserRef.implement({
  description: "A registered user of the club",
  fields: (t) => ({
    id: t.exposeID("id"),
    email: t.exposeString("email"),
    firstName: t.exposeString("firstName", { nullable: true }),
    lastNamePrefix: t.exposeString("lastNamePrefix", { nullable: true }),
    lastName: t.exposeString("lastName", { nullable: true }),
    nbbNumber: t.exposeString("nbbNumber", { nullable: true }),
    refereeLevel: t.field({
      type: RefereeLevelEnum,
      nullable: true,
      resolve: (user) => user.refereeLevel,
    }),
    foysUserId: t.exposeString("foysUserId", { nullable: true }),
    memberSince: t.exposeString("memberSince", { nullable: true }),
  }),
});
