import { describe, expect, it } from "vitest";
import { toUserDomain } from "../lib/models/user";

describe("domain model mappers", () => {
  it("maps a database user record without leaking persistence values", () => {
    const user = toUserDomain({
      id: "user-id",
      email: "user@example.com",
      firstName: "Ada",
      lastNamePrefix: null,
      lastName: "Lovelace",
      nbbNumber: "123",
      refereeLevel: "BS2",
      foysUserId: "foys-user",
      memberSince: {
        toPlainDate: () => ({ toString: () => "2025-09-01" }),
      },
    });

    expect(user).toEqual({
      id: "user-id",
      email: "user@example.com",
      firstName: "Ada",
      lastNamePrefix: null,
      lastName: "Lovelace",
      nbbNumber: "123",
      refereeLevel: "BS2",
      foysUserId: "foys-user",
      memberSince: "2025-09-01",
    });
  });
});
