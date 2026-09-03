import { describe, expect, it } from "vitest";
import { createUser } from "../lib/models/user";

describe("domain model mappers", () => {
  it("keeps the domain user shape independent from persistence values", () => {
    const user = createUser({
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
