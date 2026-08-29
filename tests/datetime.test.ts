import { describe, expect, it } from "vitest";
import { toPlainDateTime } from "../lib/types";

describe("toPlainDateTime", () => {
  it("maps a Date's UTC components to a PlainDateTime", () => {
    const date = new Date("2026-08-17T12:30:45.123Z");
    const pdt = toPlainDateTime(date);
    expect(pdt.year).toBe(2026);
    expect(pdt.month).toBe(8);
    expect(pdt.day).toBe(17);
    expect(pdt.hour).toBe(12);
    expect(pdt.minute).toBe(30);
    expect(pdt.second).toBe(45);
    expect(pdt.millisecond).toBe(123);
  });

  it("round-trips through toString", () => {
    const date = new Date("2025-03-01T00:00:00Z");
    const pdt = toPlainDateTime(date);
    expect(pdt.toString()).toBe("2025-03-01T00:00:00");
  });
});