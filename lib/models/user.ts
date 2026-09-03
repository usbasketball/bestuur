import type { FieldOutputTypes } from "@/prisma/contract.d";
import type { User } from "./types";

type DbUser = FieldOutputTypes["public"]["User"];
type DbUserRecord = Omit<
  Pick<
    DbUser,
    | "id"
    | "email"
    | "firstName"
    | "lastNamePrefix"
    | "lastName"
    | "nbbNumber"
    | "refereeLevel"
    | "foysUserId"
    | "memberSince"
  >,
  "memberSince"
> & { memberSince: unknown };

export function toUserDomain(user: DbUserRecord): User {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastNamePrefix: user.lastNamePrefix,
    lastName: user.lastName,
    nbbNumber: user.nbbNumber,
    refereeLevel: user.refereeLevel as User["refereeLevel"],
    foysUserId: user.foysUserId,
    memberSince: toPlainDateString(user.memberSince),
  };
}

function toPlainDateString(value: unknown): string | null {
  if (value && typeof value === "object" && "toPlainDate" in value) {
    return (value as { toPlainDate: () => { toString(): string } }).toPlainDate().toString();
  }
  return null;
}